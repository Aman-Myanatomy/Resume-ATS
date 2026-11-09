import React, { useState } from 'react';
import { Building2, CalendarClock, Flag, GripVertical, Handshake } from 'lucide-react';
import { anonLabel, fitLabel, formatDateTime } from '../../lib/format.js';
import { ScoreRing } from '../../components/ui.jsx';

/**
 * Pipeline board: one column per stage. Drag a card to another column to move the candidate
 * (optimistic update via the moveApplication mutation). Clicking a card opens the detail panel,
 * which also has stage buttons for keyboard and touch users.
 */
export default function KanbanBoard({ stages, applicants, blind, selectedId, onSelect, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const byStage = Object.fromEntries(stages.map(s => [s.key, []]));
  for (const a of applicants) (byStage[a.stage] || byStage.applied).push(a);

  const drop = stage => event => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || dragId;
    setOverStage(null);
    setDragId(null);
    const card = applicants.find(a => a.id === id);
    if (card && card.stage !== stage) onMove(card, stage);
  };

  return (
    <div className="jb-kanban" role="region" aria-label="Pipeline board. Drag cards between columns, or open a card to change its stage.">
      {stages.map(({ key: stage, label, kind }) => (
        <section
          key={stage}
          className={`jb-kcol jb-kcol-${kind} ${overStage === stage ? 'over' : ''}`}
          aria-label={`${label}, ${byStage[stage].length} candidates`}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overStage !== stage) setOverStage(stage); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null); }}
          onDrop={drop(stage)}
        >
          <header className="jb-kcol-head">
            <span className={`jb-kdot jb-pipe-${kind}`} aria-hidden="true" />
            <strong>{label}</strong>
            <span className="jb-kcount">{byStage[stage].length}</span>
          </header>
          <div className="jb-kcards">
            {byStage[stage].length === 0 && <p className="jb-kempty">Drop candidates here</p>}
            {byStage[stage].map(a => (
              <button
                key={a.id}
                type="button"
                draggable
                onDragStart={e => { setDragId(a.id); e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setOverStage(null); }}
                onClick={() => onSelect(a.id)}
                className={`jb-kcard ${selectedId === a.id ? 'selected' : ''} ${dragId === a.id ? 'dragging' : ''}`}
              >
                <span className="jb-kgrip" aria-hidden="true"><GripVertical size={14} /></span>
                <ScoreRing score={a.score} status={a.scoreStatus} />
                <span className="jb-kcard-main">
                  <strong>{blind ? anonLabel(a.id) : a.candidateName}</strong>
                  <small>{a.scoreStatus === 'over_limit' ? 'Not scored (plan limit)' : (a.score != null ? fitLabel(a.score, a.verdict) : '') || (a.scoreStatus === 'scored' ? '' : 'Scoring…')}</small>
                  {(a.knockoutFailed || a.nextInterviewAt || a.source === 'referral' || a.source === 'internal') && (
                    <span className="jb-kcard-tags">
                      {a.knockoutFailed && <span className="jb-flag"><Flag size={11} aria-hidden="true" /> Flag</span>}
                      {a.source === 'referral' && <span className="jb-source-tag jb-source-referral"><Handshake size={11} aria-hidden="true" /> Referral</span>}
                      {a.source === 'internal' && <span className="jb-source-tag jb-source-internal"><Building2 size={11} aria-hidden="true" /> Internal</span>}
                      {a.nextInterviewAt && <span className="jb-iv-chip"><CalendarClock size={12} aria-hidden="true" /> {formatDateTime(a.nextInterviewAt)}</span>}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
