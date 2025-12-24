import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '../../components/Layout';
import { Search, Edit, Trash2 } from 'lucide-react';
import { apiService } from '../../services/apiservice'; // Import Service

export default function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<{ name?: string; email?: string; phone?: string; vehicleId?: string; role?: string; status?: string; password?: string }>({});

  // Fetch users from C# Backend
  const loadUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  // Search filter on name, email, phone
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.phone && u.phone.toLowerCase().includes(query))
      ));
    }
  }, [searchQuery, users]);

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this user? They will not be able to login.")) {
      try {
        await apiService.deleteUser(id);
        // Refresh list after delete
        loadUsers(); 
      } catch (err) {
        alert("Failed to delete user");
      }
    }
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, phone: user.phone, vehicleId: user.vehicleId, role: user.role, status: user.status, password: user.password });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
  };

  const saveEdit = async (id: number) => {
    try {
      await apiService.updateUser(id, { name: form.name, email: form.email, phone: form.phone, vehicleId: form.vehicleId, password: form.password, role: form.role, status: form.status });
      setEditingId(null);
      setForm({});
      loadUsers();
    } catch (err) {
      alert('Failed to save changes');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <Input 
              placeholder="Search by name, email, or phone..." 
              className="pl-10 bg-white"
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-500 pt-2">{filteredUsers.length} user(s) found</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading Users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Fleet ID</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
                      ) : (
                        <p className="font-medium text-gray-900">{user.name}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <Input value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                      ) : (
                        <p className="text-sm text-gray-700">{user.email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <Input value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
                      ) : (
                        <p className="text-sm text-gray-700">{user.phone || 'N/A'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="text-gray-400 text-sm">—</span>
                      ) : editingId === user.id ? (
                        <Input value={form.vehicleId || ''} onChange={(e: any) => setForm({ ...form, vehicleId: e.target.value })} placeholder="Fleet ID" />
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.vehicleId ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.vehicleId || 'Not Assigned'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <input 
                          type="text" 
                          value={form.password || ''} 
                          onChange={(e) => setForm({ ...form, password: e.target.value })} 
                          placeholder="Enter password"
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        <p className="text-sm text-gray-700 font-mono">{user.password || 'N/A'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {editingId === user.id ? (
                        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded px-2 py-1 text-sm">
                          <option value="user">User (Driver)</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {user.role === 'admin' ? 'Admin' : 'Driver'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded px-2 py-1 text-sm">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {user.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {editingId === user.id ? (
                        <>
                          <button onClick={() => saveEdit(user.id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 mr-2">Save</button>
                          <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(user)} className="text-gray-400 hover:text-blue-600 mr-2" title="Edit user">
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)} 
                            className="text-gray-400 hover:text-red-600"
                            title="Delete user"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}