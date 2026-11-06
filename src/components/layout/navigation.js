import * as FiIcons from 'react-icons/fi';

export const NAV_SECTIONS = [
  {
    caption: 'CRM',
    items: [
      { label: 'Overview', to: '/', icon: FiIcons.FiGrid, keywords: 'dashboard home' },
      { label: 'Leads', to: '/leads', icon: FiIcons.FiTarget, count: 'leads', keywords: 'prospects' },
      { label: 'Contacts', to: '/contacts', icon: FiIcons.FiUsers, keywords: 'customers people' },
      { label: 'Companies', to: '/companies', icon: FiIcons.FiBriefcase, keywords: 'accounts organisations' },
      { label: 'Deals', to: '/deals', icon: FiIcons.FiDollarSign, keywords: 'opportunities forecast' },
      { label: 'Lead pipeline', to: '/pipeline', icon: FiIcons.FiGitBranch, keywords: 'kanban stages' },
      { label: 'Activities', to: '/activities', icon: FiIcons.FiCheckSquare, count: 'tasks', keywords: 'tasks to-do follow-ups' },
      { label: 'Calendar', to: '/calendar', icon: FiIcons.FiCalendar, keywords: 'schedule meetings' }
    ]
  },
  {
    caption: 'MARKETING',
    items: [
      { label: 'Campaigns', to: '/campaigns', icon: FiIcons.FiSend, keywords: 'roi channels' },
      { label: 'Email templates', to: '/templates', icon: FiIcons.FiMail, keywords: 'emails messages' },
      { label: 'Web forms', to: '/forms', icon: FiIcons.FiInbox, keywords: 'lead capture website' },
      { label: 'Automations', to: '/automations', icon: FiIcons.FiZap, keywords: 'workflows rules' }
    ]
  },
  {
    caption: 'SALES',
    items: [
      { label: 'Products', to: '/products', icon: FiIcons.FiPackage, keywords: 'catalog price list services' },
      { label: 'Quotes & invoices', to: '/invoices', icon: FiIcons.FiFileText, keywords: 'billing estimates payments' }
    ]
  },
  {
    caption: 'INSIGHTS',
    items: [
      { label: 'Analytics', to: '/analytics', icon: FiIcons.FiBarChart2, keywords: 'reports' },
      { label: 'Team', to: '/team', icon: FiIcons.FiUserCheck, admin: true, keywords: 'members invite users roles' }
    ]
  }
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);
