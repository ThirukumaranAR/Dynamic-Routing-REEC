import React from 'react';

export const CompanyLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-label="Company logo">
    <rect width="36" height="36" rx="8" fill="#2563eb" />
    <path d="M18 6L9 10.5V17.5C9 23.5 12.8 28.9 18 30.5C23.2 28.9 27 23.5 27 17.5V10.5L18 6Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M14 18.5L16.8 21.3L22.5 15.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);