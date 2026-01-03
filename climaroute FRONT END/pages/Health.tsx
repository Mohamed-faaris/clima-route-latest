import React, { useEffect, useState } from 'react';
import { Card } from '../components/Layout';
import { apiService } from '../services/apiservice';
import { logger, LogLevel } from '../src/utils/logger';
import { 
  Activity, 
  Database, 
  Brain, 
  Cloud, 
  Server, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  HardDrive,
  Cpu
} from 'lucide-react';

const Health = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Get frontend values
  const getApiUrl = (): string => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      try {
        const url = new URL(envUrl, window.location.origin);
        if (url.host !== window.location.host) {
          return envUrl;
        }
      } catch (e) {
        // Invalid URL, fall back to relative
      }
    }
    return '/api';
  };

  const frontendApiUrl = getApiUrl();
  const frontendLoggerLevel = LogLevel[logger.getLevel()] || 'INFO';

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const data = await apiService.get('/more-health');
        setHealthData(data);
      } catch (err) {
        setError(err.message);
      }
    };
    
    fetchHealthData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
      case 'unhealthy':
      case 'disconnected':
      case 'unreachable':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'ok':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
      case 'unhealthy':
      case 'disconnected':
      case 'unreachable':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Health Check Failed</h2>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading health data...</span>
          </div>
        </Card>
      </div>
    );
  }

  const { status, proxy, database, ai_service, metrics } = healthData;
  console.log('Health Data:', healthData);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800">System Health Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Real-time monitoring of all ClimaRoute services</p>
      </div>

      {/* Overall Status */}
      <Card className={`border-2 ${getStatusColor(status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-bold">Overall System Status</h3>
              <p className="text-sm opacity-75">Last updated: {new Date(healthData.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className="text-lg font-semibold capitalize">{status}</span>
          </div>
        </div>
      </Card>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="API Configuration" className="border border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Frontend API URL</span>
            </div>
            <p className="text-xs font-mono bg-gray-50 p-2 rounded">{frontendApiUrl}</p>
          </div>
        </Card>

        <Card title="Logging" className="border border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">Frontend Logger Level</span>
            </div>
            <p className="text-sm font-semibold text-purple-600">{frontendLoggerLevel}</p>
          </div>
        </Card>

        <Card title="Proxy Status" className="border border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {getStatusIcon(proxy?.status)}
              <span className="text-sm font-medium">Frontend Proxy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm font-semibold capitalize ${getStatusColor(proxy?.status).split(' ')[0]}`}>
                {proxy?.status}
              </span>
              {proxy?.response_ms >= 0 && (
                <span className="text-xs text-gray-500">{proxy.response_ms}ms</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Database" className="border border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              <span className="font-medium">PostgreSQL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`font-semibold capitalize ${getStatusColor(database?.status).split(' ')[0]}`}>
                {database?.status}
              </span>
              {database?.response_ms >= 0 && (
                <span className="text-sm text-gray-500">{database.response_ms}ms</span>
              )}
            </div>
            {getStatusIcon(database?.status)}
          </div>
        </Card>

        <Card title="AI Service" className="border border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-green-500" />
              <span className="font-medium">Flask AI Model</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`font-semibold capitalize ${getStatusColor(ai_service?.status).split(' ')[0]}`}>
                {ai_service?.status}
              </span>
              {ai_service?.response_ms >= 0 && (
                <span className="text-sm text-gray-500">{ai_service.response_ms}ms</span>
              )}
            </div>
            {getStatusIcon(ai_service?.status)}
          </div>
        </Card>
      </div>

      {/* Weather Model Status */}
      <Card title="Weather Model" className="border border-gray-200">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-500" />
            <span className="font-medium">Rainfall Prediction Model</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`font-semibold ${ai_service?.model_loaded ? 'text-green-600' : 'text-red-600'}`}>
              {ai_service?.model_loaded ? 'Loaded' : 'Not Available'}
            </span>
            {getStatusIcon(ai_service?.model_loaded ? 'healthy' : 'unhealthy')}
          </div>
        </div>
      </Card>

      {/* System Metrics */}
      <Card title="System Metrics" className="border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Cpu className="w-6 h-6 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold text-gray-800">{metrics?.cpu_count || 'N/A'}</div>
            <div className="text-xs text-gray-500">CPU Cores</div>
          </div>
          <div className="text-center">
            <HardDrive className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold text-gray-800">
              {metrics?.disk_free_bytes ? formatBytes(metrics.disk_free_bytes) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Free Disk</div>
          </div>
          <div className="text-center">
            <Activity className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold text-gray-800">
              {metrics?.managed_memory_bytes ? formatBytes(metrics.managed_memory_bytes) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Memory Used</div>
          </div>
          <div className="text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold text-gray-800">
              {metrics?.uptime_seconds ? formatUptime(metrics.uptime_seconds) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Uptime</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Health;