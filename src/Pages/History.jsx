import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

const History = ({ user, onClose, onTakeAssessment }) => {
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const loadAssessmentHistory = async () => {
      try {
        const q = query(
          collection(db, 'assessments'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const history = [];
        querySnapshot.forEach((doc) => {
          history.push({ id: doc.id, ...doc.data() });
        });
        history.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
        setAssessmentHistory(history);
      } catch (error) {
        console.error("Error loading assessment history:", error);
      }
    };

    loadAssessmentHistory();
  }, [user.uid]);

  const formatHistoryData = () => {
    return assessmentHistory.map(assessment => ({
      date: assessment.timestamp.toDate().toLocaleDateString(),
      score: assessment.score,
      severity: assessment.severity
    }));
  };

  const downloadProgressReport = async () => {
    if (!assessmentHistory.length) return;
    
    setIsDownloading(true);
    try {
      // Create a temporary div for the report
      const reportDiv = document.createElement('div');
      reportDiv.style.width = '800px';
      reportDiv.style.padding = '20px';
      reportDiv.style.backgroundColor = 'white';
      reportDiv.style.fontFamily = 'Arial, sans-serif';
      reportDiv.style.boxSizing = 'border-box';
      
      // Add title
      const title = document.createElement('h1');
      title.textContent = 'Mental Health Progress Report';
      title.style.textAlign = 'center';
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '20px';
      title.style.color = '#333';
      reportDiv.appendChild(title);
      
      // Add user info
      const userInfo = document.createElement('div');
      userInfo.style.marginBottom = '20px';
      userInfo.style.paddingBottom = '15px';
      userInfo.style.borderBottom = '1px solid #eee';
      userInfo.innerHTML = `
        <p style="margin: 5px 0; font-size: 14px;"><strong>User:</strong> ${user.email}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
      `;
      reportDiv.appendChild(userInfo);

      // Capture the chart from the visible DOM
      if (chartRef.current) {
        const chartDataUrl = await toPng(chartRef.current, {
          backgroundColor: 'white',
          pixelRatio: 2,
        });

        // Add chart to report
        const chartImg = document.createElement('img');
        chartImg.src = chartDataUrl;
        chartImg.style.width = '100%';
        chartImg.style.maxWidth = '760px';
        chartImg.style.height = 'auto';
        chartImg.style.display = 'block';
        chartImg.style.margin = '0 auto 20px';
        reportDiv.appendChild(chartImg);
      }
      
      // Add summary table
      const tableTitle = document.createElement('h2');
      tableTitle.textContent = 'Assessment History';
      tableTitle.style.fontSize = '18px';
      tableTitle.style.fontWeight = 'bold';
      tableTitle.style.margin = '20px 0 10px';
      tableTitle.style.color = '#333';
      reportDiv.appendChild(tableTitle);
      
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginBottom = '20px';
      table.style.fontSize = '14px';
      
      // Table header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold;">Date</th>
          <th style="padding: 10px; text-align: center; border: 1px solid #ddd; font-weight: bold;">Score</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold;">Severity</th>
        </tr>
      `;
      table.appendChild(thead);
      
      // Table body
      const tbody = document.createElement('tbody');
      assessmentHistory.forEach(assessment => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="padding: 10px; border: 1px solid #ddd;">${assessment.timestamp.toDate().toLocaleDateString()}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${assessment.score}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${assessment.severity}</td>
        `;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      reportDiv.appendChild(table);
      
      // Add notes section
      const notes = document.createElement('div');
      notes.style.borderTop = '1px solid #eee';
      notes.style.paddingTop = '15px';
      notes.style.fontSize = '14px';
      notes.innerHTML = `
        <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">Notes</h2>
        <p style="margin-bottom: 5px;"><strong>Score Interpretation:</strong></p>
        <ul style="margin-top: 0; padding-left: 20px; margin-bottom: 15px;">
          <li style="margin-bottom: 5px;">0-4: Minimal or no depression</li>
          <li style="margin-bottom: 5px;">5-9: Mild depression</li>
          <li style="margin-bottom: 5px;">10-14: Moderate depression</li>
          <li style="margin-bottom: 5px;">15-19: Moderately severe depression</li>
          <li style="margin-bottom: 5px;">20-27: Severe depression</li>
        </ul>
        <p style="font-style: italic;">This report is generated for personal reference only. Please consult with a healthcare professional for medical advice.</p>
      `;
      reportDiv.appendChild(notes);

      // Append to body temporarily
      document.body.appendChild(reportDiv);

      // Generate the report image
      const reportDataUrl = await toPng(reportDiv, {
        backgroundColor: 'white',
        pixelRatio: 2,
      });

      // Download the report
      saveAs(reportDataUrl, `mental-health-report-${new Date().toISOString().split('T')[0]}.png`);

      // Clean up
      document.body.removeChild(reportDiv);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Your Mental Health Assessment History
        </h2>
        {assessmentHistory.length > 0 && (
          <button
            onClick={downloadProgressReport}
            disabled={isDownloading}
            className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 px-4 flex items-center"
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Report
              </>
            )}
          </button>
        )}
      </div>
      
      {assessmentHistory.length > 0 ? (
        <>
          <div className="h-64 mb-8" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={formatHistoryData()}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 27]} />
                <Tooltip 
                  formatter={(value) => [`Score: ${value}`, `Severity: ${formatHistoryData().find(item => item.score === value)?.severity}`]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Depression Score" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assessmentHistory.map((assessment, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assessment.timestamp.toDate().toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assessment.score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assessment.severity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600">You haven't completed any assessments yet.</p>
          <button
            onClick={onTakeAssessment}
            className="mt-4 bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700"
          >
            Take Assessment Now
          </button>
        </div>
      )}
      
      <div className="mt-6 flex justify-center">
        <button
          onClick={onClose}
          className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 px-4"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default History;