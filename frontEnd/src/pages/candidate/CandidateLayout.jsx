import React from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, FileSearch, LayoutList, Search, Sparkles } from 'lucide-react';
import AppShell from '../../components/AppShell.jsx';
import { useGetWorkplaceQuery } from '../../store/api/publicApi.js';

const NAV = [
  { to: '/app/applications', label: 'My applications', icon: LayoutList },
  { to: '/jobs', label: 'Find jobs', icon: Search },
  { to: '/app/analyze', label: 'Analyze resume', icon: Sparkles },
  { to: '/app/results', label: 'Latest results', icon: FileSearch }
];

export default function CandidateLayout() {
  const { pathname } = useLocation();
  const { data: workplace } = useGetWorkplaceQuery();
  // Employees (work email matches a company's domain) also get their company page.
  const nav = workplace?.company
    ? [NAV[0], { to: '/app/workplace', label: `At ${workplace.company.name}`, icon: Building2 }, ...NAV.slice(1)]
    : NAV;
  const current = nav.find(item => pathname.startsWith(item.to));
  return <AppShell nav={nav} context={`Workspace / ${current?.label || 'Candidate'}`} />;
}
