import React from 'react';

const Badge = ({ children, status }) => {
  const getStatusStyles = () => {
    switch (status?.toLowerCase()) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contacted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
      case 'lost': case 'closed lost': return 'bg-red-100 text-red-800 border-red-200';
      case 'closed won': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'proposal': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'negotiation': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles()}`}>
      {children}
    </span>
  );
};

export default Badge;