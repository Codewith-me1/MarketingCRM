import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { mockUsers } from '../data/mockData';
import RoleList from '../components/settings/RoleList';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', name: 'Users', icon: FiIcons.FiUsers },
    { id: 'roles', name: 'Roles', icon: FiIcons.FiShield },
    { id: 'general', name: 'General', icon: FiIcons.FiSettings },
    { id: 'security', name: 'Security', icon: FiIcons.FiLock },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users & Control</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your team members and their access levels.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SafeIcon icon={tab.icon} />
              {tab.name}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="relative w-72">
                  <SafeIcon icon={FiIcons.FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm w-full focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
                  <SafeIcon icon={FiIcons.FiUserPlus} />
                  Add User
                </button>
              </div>

              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      <th className="p-4">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Last Login</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mockUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                              {user.avatar}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                            user.role === 'Administrator' ? 'bg-purple-50 text-purple-700' :
                            user.role === 'Manager' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            user.status === 'Active' ? 'text-emerald-600' : 'text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                            {user.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-500">{user.lastLogin}</td>
                        <td className="p-4 text-right">
                          <button className="text-gray-400 hover:text-gray-600 p-1">
                            <SafeIcon icon={FiIcons.FiMoreVertical} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'roles' && <RoleList />}
          
          {(activeTab === 'general' || activeTab === 'security') && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <SafeIcon icon={FiIcons.FiTool} className="text-2xl text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
              <p className="text-gray-500 text-sm max-w-xs mt-1">
                These settings are part of the enterprise module and will be available in the next update.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Settings;