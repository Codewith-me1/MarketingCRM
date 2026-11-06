import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { CONTACT_STATUS_LABELS } from './sync';

const ICONS = { queued: FiIcons.FiClock, 'not contacted': FiIcons.FiClock, contacted: FiIcons.FiSend, replied: FiIcons.FiMessageSquare, bounced: FiIcons.FiAlertTriangle, unsubscribed: FiIcons.FiSlash, completed: FiIcons.FiCheck };

/** Small chip showing a lead's Success.ai outreach status. */
export default function OutreachBadge({ lead, showCampaign = false }) {
  const info = lead.successai;
  if (!info?.campaignId) return null;
  const status = info.status || 'queued';
  return (
    <span className={`outreach-badge outreach-${status.replace(/\s+/g, '-')}`} title={`Success.ai · ${info.campaignName}: ${CONTACT_STATUS_LABELS[status] || status}${info.isRead ? ' · opened' : ''}`}>
      <SafeIcon icon={ICONS[status] || FiIcons.FiSend} />
      {CONTACT_STATUS_LABELS[status] || status}{info.isRead && status === 'contacted' ? ' · opened' : ''}
      {showCampaign && <em> · {info.campaignName}</em>}
    </span>
  );
}
