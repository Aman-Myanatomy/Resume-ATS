import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Results from '../../components/Results.jsx';

export default function ResultsPage() {
  const navigate = useNavigate();
  const analysis = useSelector(state => state.analysis.result);
  return <Results analysis={analysis} setActiveTab={() => navigate('/app/analyze')} />;
}
