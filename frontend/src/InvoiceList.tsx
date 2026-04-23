import React from 'react';
import { useStreamQueries } from "@c7/react";
import { Invoice } from "@daml.js/canton-subscription-billing-0.1.0/lib/Subscription/Invoice";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import { green, orange, red, grey } from '@mui/material/colors';

type InvoiceStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";

const getStatusChipColor = (status: InvoiceStatus): "success" | "warning" | "error" | "default" => {
  switch (status) {
    case "Paid":
      return "success";
    case "Pending":
      return "warning";
    case "Overdue":
      return "error";
    case "Cancelled":
      return "default";
    default:
      return "default";
  }
};

const getStatusChipStyle = (status: InvoiceStatus) => {
  switch (status) {
    case "Paid":
      return { backgroundColor: green[100], color: green[800] };
    case "Pending":
      return { backgroundColor: orange[100], color: orange[800] };
    case "Overdue":
      return { backgroundColor: red[100], color: red[800] };
    case "Cancelled":
      return { backgroundColor: grey[200], color: grey[800] };
    default:
      return {};
  }
};

/**
 * A React component that displays a list of invoices for the current party.
 * It streams active Invoice contracts from the ledger and renders them in a table.
 */
export const InvoiceList: React.FC = () => {
  const { contracts: invoices, loading } = useStreamQueries(Invoice);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading invoices...
        </Typography>
      </Box>
    );
  }

  if (invoices.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">No Invoices Found</Typography>
        <Typography variant="body1" color="text.secondary">
          You do not have any active invoices at the moment.
        </Typography>
      </Paper>
    );
  }

  // Sort invoices by due date, most recent first
  const sortedInvoices = [...invoices].sort((a, b) =>
    new Date(b.payload.dueDate).getTime() - new Date(a.payload.dueDate).getTime()
  );

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table sx={{ minWidth: 650 }} aria-label="invoice table">
        <TableHead sx={{ backgroundColor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Invoice ID</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Due Date</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedInvoices.map(({ contractId, payload }) => (
            <TableRow
              key={contractId}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              hover
            >
              <TableCell component="th" scope="row">
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {payload.invoiceId}
                </Typography>
              </TableCell>
              <TableCell align="right">
                {`${payload.amount.quantity} ${payload.amount.unit.id}`}
              </TableCell>
              <TableCell align="center">
                {new Date(payload.dueDate).toLocaleDateString()}
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={payload.status}
                  color={getStatusChipColor(payload.status as InvoiceStatus)}
                  size="small"
                  sx={getStatusChipStyle(payload.status as InvoiceStatus)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default InvoiceList;