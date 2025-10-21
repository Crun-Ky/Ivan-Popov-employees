const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Enhanced date parsing function that supports multiple formats
function parseFlexibleDate(dateStr) {
  if (!dateStr || dateStr.toLowerCase() === 'null' || dateStr.trim() === '') {
    return null;
  }

  // Common date formats to try
  const dateFormats = [
    // ISO formats
    /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
    /^\d{4}\.\d{2}\.\d{2}$/,         // YYYY.MM.DD
    
    // US formats
    /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,     // M/D/YYYY
    /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/,       // M-D-YYYY
    
    // European formats
    /^\d{2}\/\d{2}\/\d{4}$/,         // DD/MM/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,     // D/M/YYYY
    /^\d{2}\.\d{2}\.\d{4}$/,         // DD.MM.YYYY
    /^\d{1,2}\.\d{1,2}\.\d{4}$/,     // D.M.YYYY
    
    // Other formats
    /^\d{2}-\d{2}-\d{2}$/,           // YY-MM-DD
    /^\d{8}$/,                       // YYYYMMDD
  ];

  let parsedDate;

  // Try standard Date constructor first
  parsedDate = new Date(dateStr);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  // Try specific format parsing
  const cleanStr = dateStr.trim();
  
  // YYYYMMDD format
  if (/^\d{8}$/.test(cleanStr)) {
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(cleanStr.substring(6, 8));
    parsedDate = new Date(year, month, day);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }

  // DD/MM/YYYY or MM/DD/YYYY (try both)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) {
    const parts = cleanStr.split('/');
    // Try DD/MM/YYYY first (European)
    parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() == parts[2]) {
      return parsedDate;
    }
    // Try MM/DD/YYYY (US)
    parsedDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }

  // DD.MM.YYYY format
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleanStr)) {
    const parts = cleanStr.split('.');
    parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }

  // DD-MM-YYYY format
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanStr)) {
    const parts = cleanStr.split('-');
    if (parts[2].length === 4) { // DD-MM-YYYY
      parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
  }

  return null; // Could not parse
}

// Parse CSV data from text
function parseCSVData(csvText) {
  return new Promise((resolve, reject) => {
    const records = [];
    const errors = [];

    parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      data.forEach((row, index) => {
        try {
          const empId = parseInt(row.EmpID || row.empId || row.EmployeeID);
          const projectId = parseInt(row.ProjectID || row.projectId || row.ProjectId);
          const dateFromStr = row.DateFrom || row.dateFrom || row.StartDate;
          const dateToStr = row.DateTo || row.dateTo || row.EndDate;

          if (isNaN(empId) || isNaN(projectId)) {
            errors.push(`Row ${index + 1}: Invalid employee ID or project ID`);
            return;
          }

          const dateFrom = parseFlexibleDate(dateFromStr);
          if (!dateFrom) {
            errors.push(`Row ${index + 1}: Invalid date format for DateFrom: "${dateFromStr}"`);
            return;
          }

          const dateTo = parseFlexibleDate(dateToStr);
          // dateTo can be null for ongoing projects, that's valid

          records.push({
            empId,
            projectId,
            dateFrom,
            dateTo
          });
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error}`);
        }
      });

      if (errors.length > 0) {
        console.warn('Parsing errors:', errors);
      }

      resolve(records);
    });
  });
}

// Calculate overlap between two date ranges
function calculateOverlap(start1, end1, start2, end2) {
  const actualEnd1 = end1 || new Date();
  const actualEnd2 = end2 || new Date();
  
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(actualEnd1.getTime(), actualEnd2.getTime()));
  
  if (overlapStart <= overlapEnd) {
    return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }
  
  return 0;
}

// Analyze employee collaborations
function analyzeEmployees(data) {
  const errors = [];
  
  // Group by project
  const projectGroups = new Map();
  data.forEach(record => {
    if (!projectGroups.has(record.projectId)) {
      projectGroups.set(record.projectId, []);
    }
    projectGroups.get(record.projectId).push(record);
  });

  // Find pairs and calculate collaboration time
  const pairMap = new Map();

  projectGroups.forEach((employees, projectId) => {
    for (let i = 0; i < employees.length; i++) {
      for (let j = i + 1; j < employees.length; j++) {
        const emp1 = employees[i];
        const emp2 = employees[j];
        
        const overlap = calculateOverlap(emp1.dateFrom, emp1.dateTo, emp2.dateFrom, emp2.dateTo);
        
        if (overlap > 0) {
          const pairKey = `${Math.min(emp1.empId, emp2.empId)}-${Math.max(emp1.empId, emp2.empId)}`;
          
          if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              emp1: Math.min(emp1.empId, emp2.empId),
              emp2: Math.max(emp1.empId, emp2.empId),
              totalDays: 0,
              commonProjects: []
            });
          }
          
          const pair = pairMap.get(pairKey);
          pair.totalDays += overlap;
          
          const overlapStart = new Date(Math.max(emp1.dateFrom.getTime(), emp2.dateFrom.getTime()));
          const overlapEnd = new Date(Math.min(
            (emp1.dateTo || new Date()).getTime(),
            (emp2.dateTo || new Date()).getTime()
          ));
          
          pair.commonProjects.push({
            projectId,
            overlapDays: overlap,
            dateFrom: overlapStart,
            dateTo: overlapEnd
          });
        }
      }
    }
  });

  // Sort pairs by total collaboration time
  const allPairs = Array.from(pairMap.values()).sort((a, b) => b.totalDays - a.totalDays);

  // Generate summary
  const uniqueEmployees = new Set(data.map(r => r.empId)).size;
  const uniqueProjects = new Set(data.map(r => r.projectId)).size;

  const topPair = allPairs.length > 0 
    ? `Employees ${allPairs[0].emp1} and ${allPairs[0].emp2} worked together for ${allPairs[0].totalDays} days`
    : 'No employee pairs found that worked together';

  return {
    topPair,
    allPairs,
    summary: {
      totalRecords: data.length,
      uniqueEmployees,
      uniqueProjects,
      employeePairs: allPairs.length
    },
    processedData: data,
    errors
  };
}

// Sample data for testing
const SAMPLE_CSV = `EmpID,ProjectID,DateFrom,DateTo
143,12,2013-11-01,2014-01-05
218,10,2012-05-16,NULL
218,10,2012-05-16,2012-09-05
143,10,2009-01-01,2011-04-27
143,11,2014-01-05,2014-11-09
218,12,2014-11-09,2015-01-05
143,10,2012-09-05,2013-11-01
218,11,2014-01-05,2014-11-09`;

// Routes
app.use(express.json());

// Upload and analyze CSV
app.post('/api/csv/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const csvData = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path); // Clean up uploaded file

    const parsedData = await parseCSVData(csvData);
    
    if (parsedData.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data found in CSV' });
    }

    const result = analyzeEmployees(parsedData);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to process CSV file' });
  }
});

// Analyze sample data
app.post('/api/csv/analyze-sample', async (req, res) => {
  try {
    const parsedData = await parseCSVData(SAMPLE_CSV);
    const result = analyzeEmployees(parsedData);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error analyzing sample data:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze sample data' });
  }
});

// Download sample CSV
app.get('/api/csv/sample-csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=sample-employee-data.csv');
  res.send(SAMPLE_CSV);
});

app.listen(PORT, () => {
  console.log(`Simple CSV Server running on port ${PORT}`);
  console.log(`Try the sample data at: http://localhost:${PORT}/api/csv/analyze-sample`);
});