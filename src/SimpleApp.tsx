import React, { useState, ChangeEvent } from 'react';

interface EmployeeProject {
  empId: number;
  projectId: number;
  dateFrom: Date;
  dateTo: Date | null;
}

interface EmployeePair {
  emp1: number;
  emp2: number;
  totalDays: number;
  commonProjects: Array<{
    projectId: number;
    overlapDays: number;
    dateFrom: Date;
    dateTo: Date;
  }>;
}

interface AnalysisResult {
  topPair: string;
  allPairs: EmployeePair[];
  summary: {
    totalRecords: number;
    uniqueEmployees: number;
    uniqueProjects: number;
    employeePairs: number;
  };
  processedData: EmployeeProject[];
  errors: string[];
}

const App: React.FC = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrors([]);

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const response = await fetch('/api/csv/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Convert date strings back to Date objects
        const processedResult = {
          ...data.data,
          processedData: data.data.processedData.map((record: any) => ({
            ...record,
            dateFrom: new Date(record.dateFrom),
            dateTo: record.dateTo ? new Date(record.dateTo) : null
          })),
          allPairs: data.data.allPairs.map((pair: any) => ({
            ...pair,
            commonProjects: pair.commonProjects.map((project: any) => ({
              ...project,
              dateFrom: new Date(project.dateFrom),
              dateTo: new Date(project.dateTo)
            }))
          }))
        };
        setResult(processedResult);
      } else {
        setErrors([data.error || 'Failed to analyze CSV file']);
      }
    } catch (error) {
      setErrors(['Error uploading file. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleData = async () => {
    setIsLoading(true);
    setErrors([]);

    try {
      const response = await fetch('/api/csv/analyze-sample', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        const processedResult = {
          ...data.data,
          processedData: data.data.processedData.map((record: any) => ({
            ...record,
            dateFrom: new Date(record.dateFrom),
            dateTo: record.dateTo ? new Date(record.dateTo) : null
          })),
          allPairs: data.data.allPairs.map((pair: any) => ({
            ...pair,
            commonProjects: pair.commonProjects.map((project: any) => ({
              ...project,
              dateFrom: new Date(project.dateFrom),
              dateTo: new Date(project.dateTo)
            }))
          }))
        };
        setResult(processedResult);
      } else {
        setErrors([data.error || 'Failed to analyze sample data']);
      }
    } catch (error) {
      setErrors(['Error loading sample data. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSample = () => {
    window.open('/api/csv/sample-csv', '_blank');
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  // Apply theme to document body
  React.useEffect(() => {
    const theme = getThemeStyles();
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.color;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    // Also apply to html element for full coverage
    document.documentElement.style.backgroundColor = theme.background;
    
    // Cleanup function to reset when component unmounts
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, [isDarkTheme]);

  const getThemeStyles = () => {
    if (isDarkTheme) {
      return {
        background: '#1a1a1a',
        color: '#e0e0e0',
        cardBackground: '#2d2d2d',
        borderColor: '#404040',
        inputBackground: '#3a3a3a',
        buttonPrimary: '#0d6efd',
        buttonSuccess: '#198754',
        errorBackground: '#842029',
        errorColor: '#f8d7da',
        successBackground: '#0f5132',
        successColor: '#d1e7dd',
        tableHeaderBackground: '#495057',
        tableRowEven: '#343a40',
        tableRowOdd: '#2d2d2d'
      };
    } else {
      return {
        background: '#ffffff',
        color: '#333333',
        cardBackground: '#f5f5f5',
        borderColor: '#cccccc',
        inputBackground: '#ffffff',
        buttonPrimary: '#007bff',
        buttonSuccess: '#28a745',
        errorBackground: '#f8d7da',
        errorColor: '#721c24',
        successBackground: '#d4edda',
        successColor: '#155724',
        tableHeaderBackground: '#007bff',
        tableRowEven: '#f8f9fa',
        tableRowOdd: '#ffffff'
      };
    }
  };

  const theme = getThemeStyles();

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: theme.background,
      color: theme.color,
      minHeight: '100vh'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ textAlign: 'center', color: theme.color, margin: 0 }}>
            Employee Project Collaboration Analyzer
          </h1>
          <p style={{ textAlign: 'center', color: theme.color, opacity: 0.7, marginBottom: '10px' }}>
            Find pairs of employees who have worked together on common projects for the longest time
          </p>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            padding: '10px 15px',
            backgroundColor: theme.cardBackground,
            color: theme.color,
            border: `1px solid ${theme.borderColor}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isDarkTheme ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* File Upload Section */}
      <div style={{ 
        backgroundColor: theme.cardBackground, 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: `2px dashed ${theme.borderColor}`
      }}>
        <h3 style={{ color: theme.color }}>Upload CSV File</h3>
        <p style={{ fontSize: '14px', color: theme.color, opacity: 0.7 }}>
          Expected format: EmpID, ProjectID, DateFrom, DateTo (DateTo can be NULL for ongoing projects)
        </p>
        
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isLoading}
          style={{ 
            marginBottom: '10px', 
            padding: '8px',
            backgroundColor: theme.inputBackground,
            color: theme.color,
            border: `1px solid ${theme.borderColor}`,
            borderRadius: '4px'
          }}
        />
        
        <div>
          <button 
            onClick={loadSampleData}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              backgroundColor: theme.buttonPrimary,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Load Sample Data
          </button>
          
          <button 
            onClick={downloadSample}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.buttonSuccess,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Download Sample CSV
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', color: theme.color, opacity: 0.7, margin: '20px 0' }}>
          Processing CSV data...
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ 
          backgroundColor: theme.errorBackground, 
          color: theme.errorColor, 
          padding: '15px', 
          borderRadius: '4px', 
          marginBottom: '20px'
        }}>
          <h4>Errors:</h4>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Main Result */}
          <div style={{ 
            backgroundColor: theme.successBackground, 
            color: theme.successColor, 
            padding: '20px', 
            borderRadius: '4px', 
            marginBottom: '20px'
          }}>
            <h3>Result:</h3>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {result.topPair}
            </div>
            {result.allPairs.length > 0 && (
              <p>
                Employees {result.allPairs[0].emp1} and {result.allPairs[0].emp2} worked together for {result.allPairs[0].totalDays} days total
              </p>
            )}
          </div>

          {/* Summary */}
          <div style={{ 
            backgroundColor: theme.cardBackground, 
            padding: '15px', 
            borderRadius: '4px', 
            marginBottom: '20px'
          }}>
            <h4 style={{ color: theme.color }}>Summary:</h4>
            <p style={{ color: theme.color }}>Total records: {result.summary.totalRecords}</p>
            <p style={{ color: theme.color }}>Unique employees: {result.summary.uniqueEmployees}</p>
            <p style={{ color: theme.color }}>Unique projects: {result.summary.uniqueProjects}</p>
            <p style={{ color: theme.color }}>Employee pairs found: {result.summary.employeePairs}</p>
          </div>

          {/* Common Projects DataGrid */}
          {result.allPairs.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: theme.color }}>Common Projects - Employee Pairs</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  backgroundColor: theme.inputBackground,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                <thead style={{ backgroundColor: theme.tableHeaderBackground, color: 'white' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Employee ID #1</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Employee ID #2</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Project ID</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Days Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allPairs.flatMap((pair) =>
                    pair.commonProjects.map((project, idx) => (
                      <tr key={`${pair.emp1}-${pair.emp2}-${project.projectId}`} style={{ 
                        backgroundColor: idx % 2 === 0 ? theme.tableRowEven : theme.tableRowOdd 
                      }}>
                        <td style={{ padding: '12px', color: theme.color }}>{pair.emp1}</td>
                        <td style={{ padding: '12px', color: theme.color }}>{pair.emp2}</td>
                        <td style={{ padding: '12px', color: theme.color }}>{project.projectId}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: theme.color }}>{project.overlapDays}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Raw Data Table */}
          <div>
            <h3 style={{ color: theme.color }}>Processed Data:</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: theme.inputBackground,
                fontSize: '14px'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: theme.tableHeaderBackground, color: 'white' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Employee ID</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Project ID</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date From</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date To</th>
                  </tr>
                </thead>
                <tbody>
                  {result.processedData.map((record, index) => (
                    <tr key={index} style={{ 
                      backgroundColor: index % 2 === 0 ? theme.tableRowEven : theme.tableRowOdd 
                    }}>
                      <td style={{ padding: '8px', color: theme.color }}>{record.empId}</td>
                      <td style={{ padding: '8px', color: theme.color }}>{record.projectId}</td>
                      <td style={{ padding: '8px', color: theme.color }}>{formatDate(record.dateFrom)}</td>
                      <td style={{ padding: '8px', color: theme.color }}>
                        {record.dateTo ? formatDate(record.dateTo) : 'Ongoing'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;