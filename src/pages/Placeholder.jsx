import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const Placeholder = ({ title, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col items-center justify-center text-center p-8"
    >
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <SafeIcon icon={icon} className="text-4xl text-blue-600" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{title} Module</h1>
      <p className="text-gray-500 max-w-md">
        This module is currently under development. In a real application, this would contain the complete functionality for managing your {title.toLowerCase()}.
      </p>
      <button className="mt-8 bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors shadow-sm">
        Go back to Dashboard
      </button>
    </motion.div>
  );
};

export default Placeholder;