import React, { useEffect, useState } from 'react';

const Health = () => {
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/more-health')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch health data');
        }
        return res.json();
      })
      .then(data => setHealthData(data))
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!healthData) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Health Status</h1>
      <pre>{JSON.stringify(healthData, null, 2)}</pre>
    </div>
  );
};

export default Health;