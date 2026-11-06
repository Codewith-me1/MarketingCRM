import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

// Icons are passed as components (e.g. FiIcons.FiUser) so the bundler can tree-shake
// the icon set. Looking icons up by string name would pull in every icon.
const SafeIcon = ({ icon: IconComponent, ...props }) => (
  IconComponent ? <IconComponent {...props} /> : <FiAlertTriangle {...props} />
);

export default SafeIcon;
