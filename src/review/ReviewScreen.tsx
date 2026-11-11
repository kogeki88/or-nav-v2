// To review tab: approve or reject colleagues' suggestions; follow your own.
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Library } from '../features/library/useLibrary';
import { departmentLabel, myPending, requestTitle, reviewRows, timeAgo, toReview } from '../features/library/logic';
import type { ChangeRequest } from '../contracts/library';
import { Badge, Banner, Button, EmptyState, Group, Icon, ListRow, SectionLabel, SkeletonRows } from '../ui/kit';
import { C, R, S, T } from '../theme';

export default function ReviewScreen({ lib, topInset, bottomSpace }: { lib: Library; topInset: number; bottomSpace: number }) {
  const waiting = toReview(lib.data, lib.userId);
  const mine = myPending(lib.data, lib.userId);
  const decided = lib.data.requests.filter((r) => r.proposed_by === lib.userId && r.status !== 'pending').slice(0, 5);

  return (
    <ScrollView
      style={{ flex: 1, marginBottom: bottomSpace }}
      contentContainerStyle={[styles.content, { paddingTop: topInset + S.lg }]}
      refreshControl={<RefreshControl refreshing={lib.refreshing} onRefresh={() => lib.refresh(true)} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.raised} />}
    >
      <Text style={T.largeTitle} accessibilityRole="header">
        To review
      </Text>
      <Text style={T.callout}>A change becomes the truth when a colleague approves it. You can't approve your own.</Text>

      {lib.offline && <Banner text="Offline — reviews need the internet." />}

      {lib.loading ? (
        <View style={{ marginTop: S.xl }}>
          <SkeletonRows count={3} />
        </View>
      ) : (
        <>
          <SectionLabel text="Waiting for you" right={String(waiting.length)} />
          {waiting.length === 0 ? (
            <Group>
              <EmptyState icon="check-square" title="All caught up" body="When a colleague suggests a change in your departments, it shows up here." />
            </Group>
          ) : (
            <View style={{ gap: S.md }}>
              {waiting.map((r) => (
                <ReviewCard key={r.id} lib={lib} r={r} />
              ))}
            </View>
          )}

          <SectionLabel text="Your suggestions" right={mine.length ? `${mine.length} pending` : undefined} />
          {mine.length + decided.length === 0 ? (
            <Text style={T.callout}>Nothing yet. Open any item or card and tap Suggest an edit.</Text>
          ) : (
            <Group>
              {[...mine, ...decided].map((r, i) => (
                <ListRow
                  key={r.id}
                  first={i === 0}
                  icon={r.status === 'approved' ? 'check-circle' : r.status === 'rejected' ? 'x-circle' : 'clock'}
                  title={requestTitle(lib.data, r)}
                  subtitle={`${departmentLabel(lib.data, r.department_id).split(' · ').pop()} · ${timeAgo(r.created_at)}`}
                  right={<StatusBadge status={r.status} />}
                />
              ))}
            </Group>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: ChangeRequest['status'] }) {
  if (status === 'approved') return <Badge label="Approved" tone="ok" />;
  if (status === 'rejected') return <Badge label="Rejected" tone="danger" />;
  return <Badge label="Pending" tone="warn" />;
}

function ReviewCard({ lib, r }: { lib: Library; r: ChangeRequest }) {
  const [busy, setBusy] = useState<'' | 'approve' | 'reject'>('');
  const [problem, setProblem] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const rows = reviewRows(lib.data, r);

  const decide = async (d: 'approve' | 'reject') => {
    setBusy(d);
    setProblem('');
    try {
      await lib.review(r.id, d);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Badge label={r.kind === 'add' ? 'New' : r.kind === 'edit' ? 'Edit' : 'Remove'} tone={r.kind === 'remove' ? 'danger' : 'accent'} />
        <Text style={[T.callout, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
          {departmentLabel(lib.data, r.department_id).split(' · ').pop()} · {timeAgo(r.created_at)}
        </Text>
      </View>
      <Text style={T.headline}>{requestTitle(lib.data, r)}</Text>

      <View style={styles.diff}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.diffRow, i > 0 && styles.diffLine]} accessible accessibilityLabel={`${row.label}: from ${row.before} to ${row.after}`}>
            <Text style={[T.caption, { color: C.text3 }]}>{row.label}</Text>
            {r.kind !== 'add' && <Text style={[T.callout, styles.before]}>{row.before}</Text>}
            <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
              {r.kind !== 'add' && <Icon name="arrow-right" size={18} color={C.accent} />}
              <Text style={[T.body, { flex: 1 }]}>{row.after}</Text>
            </View>
          </View>
        ))}
      </View>

      {problem !== '' && <Banner text={problem} tone="danger" icon="alert-circle" />}

      {confirmReject ? (
        <View style={{ gap: S.sm }}>
          <Text style={T.callout}>Reject this change? It won't be applied.</Text>
          <View style={styles.actions}>
            <Button label="Keep it" kind="ghost" onPress={() => setConfirmReject(false)} style={{ flex: 1 }} />
            <Button label="Reject" kind="secondary" tone="danger" icon="x" busy={busy === 'reject'} onPress={() => decide('reject')} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label="Reject" kind="ghost" tone="danger" onPress={() => setConfirmReject(true)} style={{ flex: 1 }} />
          <Button label="Approve" kind="secondary" icon="check" busy={busy === 'approve'} onPress={() => decide('approve')} style={{ flex: 1.4 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.sm },
  card: { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: S.lg, gap: S.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  diff: { borderRadius: R.control, backgroundColor: C.bg, paddingHorizontal: S.md },
  diffRow: { paddingVertical: S.md, gap: 4 },
  diffLine: { borderTopWidth: 1, borderTopColor: C.line },
  before: { color: C.text3, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: S.md },
});
