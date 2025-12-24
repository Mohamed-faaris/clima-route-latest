
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Input } from '../components/Layout';
import { apiService } from '../services/apiservice';
import { User, Smartphone, Mail, Save, Lock, Truck } from 'lucide-react';

export default function Settings() {
   const [loading, setLoading] = useState(false);
   const { user } = useAuth();
   const { settings, setSettings } = useSettings();
   const [userPassword, setUserPassword] = useState<string>('********');
   const [userName, setUserName] = useState<string>('');
   const [userEmail, setUserEmail] = useState<string>('');
   const [userPhone, setUserPhone] = useState<string>('');
   const [vehicleId, setVehicleId] = useState<string>('');
   const [userId, setUserId] = useState<number | null>(null);

   // Handle temperature unit change - applies immediately
   const handleTemperatureChange = async (unit: 'C' | 'F') => {
      await setSettings({ temperatureUnit: unit });
   };

   // Handle time format change - applies immediately
   const handleTimeFormatChange = async (format: '12' | '24') => {
      await setSettings({ timeFormat: format });
   };

   const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

   const handleSave = () => {
      if (!user?.email || !userId) {
         setSaveMessage({ type: 'error', text: 'User session not found. Please login again.' });
         return;
      }

      // Validate Fleet ID (not empty if provided, proper format)
      if (vehicleId && vehicleId.trim().length < 3) {
         setSaveMessage({ type: 'error', text: 'Fleet ID must be at least 3 characters long.' });
         return;
      }

      // Validate required fields
      if (!userName.trim()) {
         setSaveMessage({ type: 'error', text: 'Name is required.' });
         return;
      }

      if (!userEmail.trim() || !userEmail.includes('@')) {
         setSaveMessage({ type: 'error', text: 'Valid email is required.' });
         return;
      }

      setLoading(true);
      setSaveMessage(null);

      (async () => {
         try {
            // Save profile information including Fleet ID
            const profileData: any = {
               name: userName.trim(),
               email: userEmail.trim(),
               phone: userPhone.trim(),
               password: userPassword,
               vehicleId: vehicleId.trim()
            };
            
            const result = await apiService.updateUser(userId, profileData);
            
            if (!result || !result.success) {
               throw new Error('Update failed');
            }
            
            // Update localStorage with new user data
            const updatedUser = {
               email: userEmail.trim(),
               name: userName.trim(),
               role: user.role,
               vehicleId: vehicleId.trim()
            };
            localStorage.setItem('clima_user', JSON.stringify(updatedUser));
            localStorage.setItem('userEmail', userEmail.trim());
            
            // Show success message
            setSaveMessage({ type: 'success', text: 'Profile and Fleet ID saved successfully!' });
            
            // Clear message after 3 seconds
            setTimeout(() => setSaveMessage(null), 3000);
         } catch (err) {
            console.error('Save settings failed', err);
            setSaveMessage({ type: 'error', text: 'Failed to save changes. Please try again.' });
         } finally {
            setLoading(false);
         }
      })();
   };

   // Load user profile data on mount
   React.useEffect(() => {
      (async () => {
         if (!user?.email) return;
         try {
            // Fetch user data to get all profile information
            const users: any = await apiService.getUsers();
            const currentUser = users?.find((u: any) => u.email === user.email);
            if (currentUser) {
               setUserId(currentUser.id);
               setUserName(currentUser.name || '');
               setUserEmail(currentUser.email || '');
               setUserPhone(currentUser.phone || '');
               setUserPassword(currentUser.password || '********');
               setVehicleId(currentUser.vehicleId || '');
            }
         } catch (e) { console.error(e); }
      })();
   }, [user?.email]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Save Message Toast */}
      {saveMessage && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-300 text-green-800' 
            : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{saveMessage.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your profile and application preferences</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="shadow-lg shadow-blue-900/20 w-full sm:w-auto">
           <Save size={18} />
           {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile */}
        <div className="space-y-6">
          <Card title="Profile Information">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm relative">
                <User size={40} />
                <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 border-2 border-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{user?.name ?? 'Your Name'}</h3>
              <p className="text-sm text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Fleet Driver'}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="pl-10" />
                </div>
              </div>
               <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                   <Smartphone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input value={userPhone} onChange={(e) => setUserPhone(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                <div className="relative">
                   <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <Input type="text" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className="pl-10" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card title="General Preferences" className="relative overflow-hidden">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Time Format</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => handleTimeFormatChange('12')} className={`flex-1 py-1.5 text-sm font-medium rounded ${settings.timeFormat==='12' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>12-hour</button>
                      <button onClick={() => handleTimeFormatChange('24')} className={`flex-1 py-1.5 text-sm font-medium rounded ${settings.timeFormat==='24' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>24-hour</button>
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => handleTemperatureChange('F')} className={`flex-1 py-1.5 text-sm font-medium rounded ${settings.temperatureUnit==='F' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>°F Fahrenheit</button>
                      <button onClick={() => handleTemperatureChange('C')} className={`flex-1 py-1.5 text-sm font-medium rounded ${settings.temperatureUnit==='C' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>°C Celsius</button>
                   </div>
                </div>
             </div>
          </Card>

          <Card title="Fleet Details">
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle ID</label>
                   <div className="relative">
                      <Truck className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <Input 
                         value={vehicleId} 
                         onChange={(e) => setVehicleId(e.target.value)} 
                         placeholder="Enter your vehicle ID (e.g., FLT-8834)"
                         className="pl-10" 
                      />
                   </div>
                   <p className="text-xs text-gray-400 mt-1">This ID will be used across all trip records</p>
                </div>
                <div className="pt-4 border-t border-gray-100">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">License Status</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Active</span>
                   </div>
                </div>
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
