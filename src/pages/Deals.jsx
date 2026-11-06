import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { mockDeals, dealStages } from '../data/mockData';
import Badge from '../components/ui/Badge';

const Deals = () => {
  // Group deals by stage
  const columns = dealStages.map(stageName => ({
    name: stageName,
    deals: mockDeals.filter(deal => deal.stage === stageName)
  }));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <div className="h-6 w-px bg-gray-300"></div>
          <select className="bg-transparent text-sm font-medium text-gray-600 cursor-pointer focus:outline-none hover:text-gray-900">
            <option>All Deals</option>
            <option>My Deals</option>
            <option>Closing This Month</option>
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <div className="bg-white border border-gray-300 rounded-md p-1 flex shadow-sm mr-2">
            <button className="p-1 px-2 text-gray-400 hover:text-gray-700 rounded"><SafeIcon icon={FiIcons.FiList} /></button>
            <button className="p-1 px-2 bg-gray-100 text-gray-800 rounded shadow-sm"><SafeIcon icon={FiIcons.FiColumns} /></button>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2">
            <SafeIcon icon={FiIcons.FiPlus} />
            Create Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => {
            const columnTotal = column.deals.reduce((sum, deal) => sum + deal.amount, 0);
            
            return (
              <div key={column.name} className="w-80 flex flex-col bg-gray-100/50 rounded-xl overflow-hidden border border-gray-200/60">
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">{column.name}</h3>
                    <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{column.deals.length}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">{formatCurrency(columnTotal)}</p>
                </div>
                
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {column.deals.map((deal) => (
                    <motion.div 
                      key={deal.id}
                      whileHover={{ y: -2 }}
                      className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {formatCurrency(deal.amount)}
                        </span>
                        <button className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-gray-700">
                          <SafeIcon icon={FiIcons.FiMoreVertical} />
                        </button>
                      </div>
                      <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">{deal.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{deal.company}</p>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center text-xs text-gray-400 gap-1" title="Closing Date">
                          <SafeIcon icon={FiIcons.FiCalendar} />
                          {new Date(deal.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <img 
                          src={`https://ui-avatars.com/api/?name=${deal.owner}&background=random&size=24`} 
                          alt={deal.owner}
                          className="w-6 h-6 rounded-full border border-gray-200"
                          title={deal.owner}
                        />
                      </div>
                    </motion.div>
                  ))}
                  
                  {column.deals.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No deals here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default Deals;