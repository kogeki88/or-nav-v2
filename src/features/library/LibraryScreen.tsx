// Library view: search and browse your department's preference cards and items.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Banner, Button, Chips, EmptyState, Group, Icon, IconButton, ListRow, SearchField, SectionLabel, SkeletonRows } from '../../ui/kit';
import { C, F, S, T } from '../../theme';
import DepartmentSheet from './DepartmentSheet';
import { itemIcon } from './icons';
import LibrarySheet, { Selection } from './LibrarySheet';
import type { SearchEngine } from '../../contracts/search';
import { cardSubtitle, departmentLabel, itemLocation, pendingFor, timeAgo } from './logic';
import type { Library } from './useLibrary';

type Filter = 'all' | 'cards' | 'items';
const PREVIEW = 5; // rows per section in "All" before "Show all"

export default function LibraryScreen({
  lib,
  search,
  topInset,
  bottomSpace,
  jobRole,
  openRequest,
  header,
}: {
  /** Drawn above the list (the shell's back bar), inside this screen so its sheets cover it too. */
  header?: ReactNode;
  lib: Library;
  /** The search port; the shell builds the engine. */
  search: SearchEngine;
  topInset: number;
  bottomSpace: number;
  jobRole: string | null;
  /** From the omnibar: open this item or card (n changes on every request). */
  openRequest?: { selection: Selection; n: number } | null;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pickDept, setPickDept] = useState(false);

  useEffect(() => {
    if (openRequest) setSelection(openRequest.selection);
  }, [openRequest]);

  const deptItems = useMemo(() => lib.data.items.filter((i) => i.department_id === lib.deptId), [lib.data.items, lib.deptId]);
  const deptCards = useMemo(() => lib.data.cards.filter((c) => c.department_id === lib.deptId), [lib.data.cards, lib.deptId]);
  const index = useMemo(() => search.index(deptItems, deptCards), [search, deptItems, deptCards]);
  const results = useMemo(() => index.search(query), [index, query]);
  const items = useMemo(() => results.items.map((r) => r.record), [results]);
  const cards = useMemo(() => results.cards.map((r) => r.record), [results]);

  const showCards = filter !== 'items';
  const showItems = filter !== 'cards';
  const cap = (n: number) => (filter === 'all' && query === '' ? Math.min(n, PREVIEW) : n);
  const noDept = !lib.loading && lib.mine.length === 0;
  const nothing = !lib.loading && lib.deptId && (showCards ? cards.length : 0) + (showItems ? items.length : 0) === 0;

  return (
    <View style={{ flex: 1 }} pointerEvents="box-none">
      {header}
      <ScrollView
        style={{ flex: 1, marginBottom: bottomSpace }}
        contentContainerStyle={[styles.content, { paddingTop: topInset + S.lg }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={lib.refreshing} onRefresh={() => lib.refresh(true)} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.raised} />}
      >
        <View style={styles.titleRow}>
          <Text style={T.largeTitle} accessibilityRole="header">
            Library
          </Text>
          {lib.deptId && <IconButton name="plus" label="Suggest something new" onPress={() => setSelection({ type: 'new' })} color={C.onAccent} bg={C.accent} />}
        </View>

        {/* Department is changed from the name sheet now; here it is only shown. */}
        {lib.deptId && (
          <View style={styles.dept}>
            <Icon name="briefcase" size={18} color={C.text3} />
            <Text style={styles.deptText} numberOfLines={1}>
              {departmentLabel(lib.data, lib.deptId)}
            </Text>
          </View>
        )}

        {lib.offline && <Banner text={`Offline — showing your saved copy${lib.data.loadedAt ? ` from ${timeAgo(lib.data.loadedAt)}` : ''}.`} />}
        {!lib.offline && lib.error !== '' && <Banner text={lib.error} tone="danger" icon="alert-circle" />}

        {!noDept && (
          <View style={{ gap: S.md, marginTop: S.sm }}>
            <SearchField value={query} onChange={setQuery} placeholder="Search items, surgeons, procedures" />
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'cards', label: 'Cards', count: cards.length },
                { key: 'items', label: 'Items', count: items.length },
              ]}
            />
          </View>
        )}

        {lib.loading && (
          <View style={{ marginTop: S.xl }}>
            <SkeletonRows count={4} />
          </View>
        )}

        {noDept && (
          <EmptyState
            icon="briefcase"
            title="Join your department"
            body="Pick your hospital and department to see its preference cards and supplies."
            action={<Button label="Choose department" icon="plus" onPress={() => setPickDept(true)} style={{ alignSelf: 'stretch' }} />}
          />
        )}

        {nothing && query !== '' && <EmptyState icon="search" title={`No matches for “${query}”`} body="Try another spelling, or a shorter word." />}
        {nothing && query === '' && (
          <EmptyState
            icon="book-open"
            title="Start this department's library"
            body="Suggest the first item or preference card. A colleague reviews it before it appears."
            action={<Button label="Suggest something" icon="plus" onPress={() => setSelection({ type: 'new' })} style={{ alignSelf: 'stretch' }} />}
          />
        )}

        {!lib.loading && showCards && cards.length > 0 && (
          <View>
            <SectionLabel text="Preference cards" right={String(cards.length)} />
            <Group>
              {cards.slice(0, cap(cards.length)).map((c, i) => (
                <ListRow
                  key={c.id}
                  first={i === 0}
                  icon="clipboard"
                  title={c.procedure}
                  subtitle={cardSubtitle(c)}
                  right={pendingFor(lib.data.requests, 'card', c.id).length ? <Badge label="Pending" tone="warn" /> : undefined}
                  onPress={() => setSelection({ type: 'card', id: c.id })}
                />
              ))}
            </Group>
            {cap(cards.length) < cards.length && <Button kind="ghost" label={`Show all ${cards.length} cards`} onPress={() => setFilter('cards')} />}
          </View>
        )}

        {!lib.loading && showItems && items.length > 0 && (
          <View>
            <SectionLabel text="Items" right={String(items.length)} />
            <Group>
              {items.slice(0, cap(items.length)).map((it, i) => (
                <ListRow
                  key={it.id}
                  first={i === 0}
                  icon={itemIcon(it.category)}
                  title={it.name}
                  subtitle={itemLocation(it)}
                  right={pendingFor(lib.data.requests, 'item', it.id).length ? <Badge label="Pending" tone="warn" /> : undefined}
                  onPress={() => setSelection({ type: 'item', id: it.id })}
                />
              ))}
            </Group>
            {cap(items.length) < items.length && <Button kind="ghost" label={`Show all ${items.length} items`} onPress={() => setFilter('items')} />}
          </View>
        )}
      </ScrollView>

      <LibrarySheet lib={lib} selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />
      <DepartmentSheet lib={lib} open={pickDept} onClose={() => setPickDept(false)} jobRole={jobRole} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dept: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', maxWidth: '100%' },
  deptText: { fontFamily: F, color: C.text2, fontSize: 16, fontWeight: '500', flexShrink: 1 },
});
