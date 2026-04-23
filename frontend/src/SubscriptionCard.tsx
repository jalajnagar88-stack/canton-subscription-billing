import React from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Divider,
  Button,
  ButtonGroup,
  useColorModeValue,
  Flex,
  Spacer,
  Tag,
} from '@chakra-ui/react';
import { Subscription, SubscriptionStatus, BillingCycle } from '@canton-subscription-billing/daml-codegen/dist/Subscription';
import { ContractId } from '@c7/ledger';

// --- Type Aliases for Clarity ---
type SubscriptionContract = {
  contractId: ContractId<Subscription>;
  payload: Subscription;
};

// --- Props Interface ---
interface SubscriptionCardProps {
  subscription: SubscriptionContract;
  onCancel: (contractId: ContractId<Subscription>) => void;
  isCancelling?: boolean;
}

// --- Helper Functions ---
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (amount: string): string => {
  // Assuming USD for simplicity. A real app would handle multiple currencies.
  return `$${parseFloat(amount).toFixed(2)}`;
};

const getStatusColorScheme = (status: SubscriptionStatus): string => {
  if ('Active' in status) return 'green';
  if ('InGracePeriod' in status) return 'yellow';
  if ('Suspended' in status) return 'orange';
  if ('Terminated' in status) return 'red';
  return 'gray';
};

const getBillingCycleText = (cycle: BillingCycle): string => {
    if ('Monthly' in cycle) return 'Month';
    if ('Yearly' in cycle) return 'Year';
    return 'Period';
}

// --- Sub-components for Rendering Status ---
const StatusDetails: React.FC<{ status: SubscriptionStatus }> = ({ status }) => {
  const textColor = useColorModeValue('gray.600', 'gray.400');

  if ('Active' in status) {
    return <Text fontSize="sm" color={textColor}>Service is active and paid up to date.</Text>;
  }
  if ('InGracePeriod' in status) {
    return (
      <Text fontSize="sm" color="yellow.600">
        Payment failed. Service access will be suspended after {formatDate(status.InGracePeriod.gracePeriodEnds)}.
      </Text>
    );
  }
  if ('Suspended' in status) {
    return <Text fontSize="sm" color="orange.600">Service is suspended due to non-payment. Please update your payment method.</Text>;
  }
  if ('Terminated' in status) {
    return <Text fontSize="sm" color="red.600">Terminated: {status.Terminated.reason}</Text>;
  }
  return null;
};

// --- Main Component ---
export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ subscription, onCancel, isCancelling }) => {
  const { contractId, payload } = subscription;
  const { planName, price, billingCycle, nextBillingDate, status, provider } = payload;

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const isActionable = 'Active' in status || 'InGracePeriod' in status;
  const isTerminated = 'Terminated' in status;
  const statusKey = Object.keys(status)[0];

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      p={5}
      bg={cardBg}
      borderColor={borderColor}
      boxShadow="sm"
      opacity={isTerminated ? 0.6 : 1}
      transition="box-shadow 0.2s"
      _hover={{ boxShadow: "md" }}
    >
      <VStack align="stretch" spacing={4}>
        {/* Header: Plan Name and Status */}
        <Flex align="center" justify="space-between">
          <Box>
            <Text fontWeight="bold" fontSize="xl" color={useColorModeValue('gray.700', 'white')}>
              {planName}
            </Text>
            <Text fontSize="sm" color="gray.500">
              Provider: {provider.slice(0, 10)}...
            </Text>
          </Box>
          <Badge
            colorScheme={getStatusColorScheme(status)}
            variant="solid"
            fontSize="xs"
            px={3}
            py={1.5}
            borderRadius="full"
            textTransform="uppercase"
          >
            {statusKey}
          </Badge>
        </Flex>

        {/* Status Details */}
        <StatusDetails status={status} />
        <Divider />

        {/* Billing Information */}
        <HStack justifyContent="space-between" align="flex-start">
          <VStack align="start" spacing={0}>
            <Text fontSize="sm" color="gray.500">Billing</Text>
            <Text fontWeight="bold" fontSize="lg">
              {formatCurrency(price)} / {getBillingCycleText(billingCycle)}
            </Text>
          </VStack>
          {!isTerminated && (
            <VStack align="end" spacing={0}>
              <Text fontSize="sm" color="gray.500">Next Charge</Text>
              <Text fontWeight="medium" fontSize="md">
                {formatDate(nextBillingDate)}
              </Text>
            </VStack>
          )}
        </HStack>
        <Tag size="sm" variant="subtle" colorScheme="gray" alignSelf="flex-start">
            ID: {contractId.substring(0, 12)}...
        </Tag>


        {/* Action Buttons */}
        {isActionable && (
          <>
            <Divider />
            <ButtonGroup spacing={4} width="100%" justifyContent="flex-end">
              <Button
                variant="ghost"
                colorScheme="red"
                onClick={() => onCancel(contractId)}
                isLoading={isCancelling}
                isDisabled={isCancelling}
              >
                Cancel Subscription
              </Button>
            </ButtonGroup>
          </>
        )}
      </VStack>
    </Box>
  );
};