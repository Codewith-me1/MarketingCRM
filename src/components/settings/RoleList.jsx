import React from 'react';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { rolePermissions } from '../../data/mockData';

const RoleList = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Roles & Permissions</h3>
        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
          <SafeIcon icon={FiIcons.FiPlus} />
          Create New Role
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rolePermissions.map((role) => (
          <div key={role.role} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-gray-900">{role.role}</h4>
              <button className="text-gray-400 hover:text-gray-600">
                <SafeIcon icon={FiIcons.FiEdit2} className="text-sm" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 h-8 line-clamp-2">{role.description}</p>
            
            <div className="space-y-2 pt-4 border-t border-gray-50">
              {Object.entries(role.permissions).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 capitalize">{key}</span>
                  <span className={`font-medium ${
                    value === 'Full Access' ? 'text-emerald-600' : 
                    value === 'No Access' ? 'text-red-500' : 'text-blue-600'
                  }`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleList;