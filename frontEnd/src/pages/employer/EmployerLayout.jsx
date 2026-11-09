import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Building2, CalendarDays, Handshake, KanbanSquare, PlusCircle } from 'lucide-react';
import AppShell from '../../components/AppShell.jsx';

export default function EmployerLayout() {
  const user = useSelector(state => state.auth.user);
  const { pathname } = useLocation();
  const company = user?.company;
  const nav = [
    { to: '/employer', label: 'Jobs & pipeline', icon: KanbanSquare, end: true },
    { to: '/employer/interviews', label: 'Interviews', icon: CalendarDays },
    { to: '/employer/referrals', label: 'Referrals', icon: Handshake },
    { to: '/employer/jobs/new', label: 'Post a job', icon: PlusCircle },
    { to: '/employer/company', label: 'Company profile', icon: Building2 }
  ];
  const current = nav.slice(1).find(item => pathname.startsWith(item.to));
  return <AppShell nav={nav} context={`${company?.name || 'Company'} / ${current?.label || 'Hiring'}`} />;
}
