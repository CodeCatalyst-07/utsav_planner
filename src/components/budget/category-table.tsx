'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Check, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MoneyDisplay } from '@/components/ui/money-display';
import { formatInr } from '@/domain/money/inr';
import { BudgetLine } from '@/domain/rules/budget';
import { CATEGORY_COLORS } from './category-colors';

export interface CategoryTableProps {
  lines: BudgetLine[];
  total: number;
  onSetOverride: (categoryId: string, amount: number) => void;
  onClearOverride: (categoryId: string) => void;
}

export function CategoryTable({
  lines,
  total,
  onSetOverride,
  onClearOverride,
}: CategoryTableProps) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [overrideInputVal, setOverrideInputVal] = useState<string>('');
  const [openWhyFormulaId, setOpenWhyFormulaId] = useState<string | null>(null);
  const overrideInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCategoryId) {
      overrideInputRef.current?.focus();
    }
  }, [editingCategoryId]);

  const handleStartEdit = (categoryId: string, currentAmount: number) => {
    setEditingCategoryId(categoryId);
    setOverrideInputVal(String(currentAmount));
  };

  const handleSaveOverride = (categoryId: string) => {
    const parsed = parseInt(overrideInputVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onSetOverride(categoryId, parsed);
    }
    setEditingCategoryId(null);
  };

  const handleResetOverride = (categoryId: string) => {
    onClearOverride(categoryId);
    setEditingCategoryId(null);
  };

  const sumLines = lines.reduce((acc, l) => acc + l.amount, 0);
  const unallocated = total - sumLines;
  const isOverBudget = unallocated < 0;
  const isUnallocated = unallocated > 0;

  return (
    <div className="space-y-6">
      {/* Stacked Horizontal Bar of Categories with 2px cream gap */}
      <section aria-labelledby="stacked-bar-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="stacked-bar-heading" className="font-serif text-lg font-bold text-ink">
            Category Breakdown
          </h2>
          <span className="text-ink/65 text-xs">12 Engine Categories</span>
        </div>

        <div
          className="flex h-6 w-full overflow-hidden rounded-control bg-bg p-0.5"
          style={{ gap: '2px' }}
          aria-hidden="true"
        >
          {lines.map((line) => {
            const percentWidth = Math.max(0, line.percent);
            const color = CATEGORY_COLORS[line.id] || 'var(--cat-misc)';
            if (percentWidth <= 0) return null;

            return (
              <div
                key={line.id}
                style={{
                  width: `${percentWidth}%`,
                  backgroundColor: color,
                }}
                className="h-full rounded-sm transition-all duration-200"
                title={`${line.label}: ${formatInr(line.amount)} (${line.percent}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {lines.map((line) => {
            const color = CATEGORY_COLORS[line.id] || 'var(--cat-misc)';
            return (
              <div
                key={line.id}
                className="border-surface-border/50 flex items-center gap-2 rounded-control border bg-surface p-1.5"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{line.label}</p>
                  <p className="text-ink/65 tabular-nums">
                    {line.percent}% • {formatInr(line.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Authoritative Accessible Table */}
      <section aria-labelledby="table-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="table-heading" className="font-serif text-xl font-bold text-ink">
            Authoritative Category Allocations
          </h2>
          <span className="text-ink/60 text-xs">Click edit to override any row</span>
        </div>

        <div
          aria-label="Budget allocations and overrides table"
          className="w-full overflow-x-auto rounded-card border border-surface-border bg-surface"
        >
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">
              Authoritative celebration budget allocation, percentages, explanation formulas, and
              user overrides.
            </caption>
            <thead>
              <tr className="bg-bg/60 border-b border-surface-border text-xs font-semibold text-ink">
                <th scope="col" className="px-4 py-3">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Share
                </th>
                <th scope="col" className="px-4 py-3">
                  Why this number?
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-surface-border/60 divide-y">
              {lines.map((line) => {
                const isEditing = editingCategoryId === line.id;
                const isOverridden = line.source === 'override';
                const isFormulaOpen = openWhyFormulaId === line.id;

                return (
                  <tr key={line.id} className="hover:bg-bg/30">
                    <th scope="row" className="px-4 py-3 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <span>{line.label}</span>
                        {isOverridden && (
                          <span className="bg-secondary/15 rounded px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                            Edited by you
                          </span>
                        )}
                      </div>
                    </th>

                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {isEditing ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <span className="text-ink/60 text-xs">₹</span>
                          <Input
                            ref={overrideInputRef}
                            type="number"
                            min={0}
                            value={overrideInputVal}
                            onChange={(e) => setOverrideInputVal(e.target.value)}
                            className="h-8 w-28 text-right text-xs tabular-nums"
                            aria-label={`Override amount for ${line.label}`}
                          />
                        </div>
                      ) : (
                        <MoneyDisplay amount={line.amount} />
                      )}
                    </td>

                    <td className="text-ink/75 px-4 py-3 text-right tabular-nums">
                      {line.percent}%
                    </td>

                    <td className="text-ink/70 px-4 py-3 text-xs">
                      <div>
                        <button
                          type="button"
                          onClick={() => setOpenWhyFormulaId(isFormulaOpen ? null : line.id)}
                          className="touch-target inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          aria-expanded={isFormulaOpen}
                        >
                          <span>{isFormulaOpen ? 'Hide formula' : 'View formula'}</span>
                          {isFormulaOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>

                        {isFormulaOpen && (
                          <div className="text-ink/80 mt-1.5 rounded-control bg-bg p-2 text-[11px] leading-relaxed">
                            <p className="font-semibold">{line.explanation.formula}</p>
                            <pre className="text-ink/65 mt-1 overflow-x-auto text-[10px]">
                              {JSON.stringify(line.explanation.inputs, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-xs">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveOverride(line.id)}
                            className="touch-target hover:bg-secondary/90 flex h-7 w-7 items-center justify-center rounded bg-secondary text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                            aria-label={`Save override for ${line.label}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(null)}
                            className="touch-target flex h-7 w-7 items-center justify-center rounded border border-surface-border text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Cancel editing"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() => handleResetOverride(line.id)}
                              className="touch-target text-ink/70 flex h-7 w-7 items-center justify-center rounded border border-surface-border hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              title="Reset to engine suggestion"
                              aria-label={`Reset ${line.label} to suggested`}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(line.id, line.amount)}
                          className="touch-target hover:bg-primary/5 rounded px-2.5 py-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {(isOverBudget || isUnallocated) && (
                <tr className={isOverBudget ? 'bg-danger/10 font-bold' : 'bg-warning/10 font-bold'}>
                  <th scope="row" className="px-4 py-3 text-ink">
                    {isOverBudget ? 'Over Budget Reserve' : 'Unallocated Buffer'}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <MoneyDisplay amount={Math.abs(unallocated)} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Math.round((Math.abs(unallocated) / total) * 100)}%
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-xs">
                    {isOverBudget
                      ? 'Overrides exceed initial total budget ceiling.'
                      : 'Remaining buffer not allocated to any specific category.'}
                  </td>
                </tr>
              )}

              <tr className="bg-bg/80 border-t-2 border-surface-border font-bold text-ink">
                <th scope="row" className="px-4 py-3.5">
                  Total Celebration Budget
                </th>
                <td className="px-4 py-3.5 text-right text-base tabular-nums">
                  <MoneyDisplay amount={total} />
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums">100%</td>
                <td colSpan={2} className="text-ink/70 px-4 py-3.5 text-xs">
                  {lines.length} categories balanced
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
