// src/components/ProjectCard.tsx
import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Button, Stack } from '@mui/material';
import { Project } from '../models/User';
import { motion } from 'framer-motion';

interface Props {
  project: Project;
  onEdit?: (p: Project) => void;
  onDelete?: (id: string) => void;
  onApprove?: (p: Project) => void;
  onReject?: (p: Project) => void;
}

export default function ProjectCard({ project, onEdit, onDelete, onApprove, onReject }: Props) {
  const statusColor = project.status === 'Approved' ? 'success' : project.status === 'Rejected' ? 'error' : 'warning';

  return (
    <motion.div whileHover={{ y: -6 }}>
      <Card sx={{ p: 2, borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={800}>{project.name}</Typography>
              <Typography color="text.secondary" variant="body2">{project.gitRepo}</Typography>
            </Box>

            <Chip label={project.status} color={statusColor as any} />
          </Stack>

          <Typography sx={{ mt: 1 }} color="text.secondary">{project.description}</Typography>

          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <Typography variant="caption">Team Lead:</Typography>
            <Typography variant="body2">{project.teamLead || '-'}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} mt={2}>
            <Button size="small" variant="outlined" onClick={() => onEdit?.(project)}>Edit</Button>
            <Button size="small" color="success" variant="contained" onClick={() => onApprove?.(project)}>Approve</Button>
            <Button size="small" color="error" variant="outlined" onClick={() => onReject?.(project)}>Reject</Button>
            <Button size="small" color="inherit" onClick={() => onDelete?.(project.id)}>Delete</Button>
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );
}
