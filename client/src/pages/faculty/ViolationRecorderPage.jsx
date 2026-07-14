import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Button } from '@mantine/core';
import MyViolationsTable from '../../components/faculty/MyViolationsTable';
import RecordViolationModal from '../../components/faculty/RecordViolationModal';

export default function ViolationRecorderPage({ user }) {
  const [showRecord, setShowRecord] = useState(false);

  return (
    <Layout user={user}>
      <PageHeader
        title="Student Violations"
        subtitle="Student violations you've recorded"
        action={<Button size="md" onClick={() => setShowRecord(true)}>+ Record Student Violation</Button>}
      />
      <MyViolationsTable />
      <RecordViolationModal open={showRecord} onClose={() => setShowRecord(false)} />
    </Layout>
  );
}
