import React, { useState } from 'react';
import {
    Box,
    Button,
    HStack,
    Text,
    VStack,
    Portal,
    Stack,
} from '@chakra-ui/react';

interface HalftimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (receivingTeam: 'home' | 'away', homeDefendingGoal: 'left' | 'right') => void;
    homeTeamName: string;
    awayTeamName: string;
}

export const HalftimeModal: React.FC<HalftimeModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    homeTeamName,
    awayTeamName,
}) => {
    const [receivingTeam, setReceivingTeam] = useState<'home' | 'away'>('home');
    const [homeDefendingGoal, setHomeDefendingGoal] = useState<'left' | 'right'>('left');

    const handleConfirm = () => {
        onConfirm(receivingTeam, homeDefendingGoal);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Portal>
            {/* Backdrop */}
            <Box
                position="fixed"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bg="blackAlpha.800"
                zIndex={1100}
                onClick={onClose}
            />
            {/* Modal Content */}
            <Box
                position="fixed"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                bg="gray.900"
                borderRadius="xl"
                boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
                border="2px solid"
                borderColor="blue.400"
                maxW="500px"
                w="90%"
                zIndex={1101}
                onClick={(e) => e.stopPropagation()}
            >
                <Stack gap={0}>
                    <Box px={6} py={4} borderBottom="2px solid" borderColor="blue.400">
                        <Text fontSize="xl" fontWeight="700" color="white">
                            Start 3rd Quarter
                        </Text>
                    </Box>
                    <Box px={6} py={6}>
                        <VStack align="stretch" gap={6}>
                            <Box>
                                <Text fontWeight="bold" mb={2} color="gray.300">
                                    Who will receive the kickoff?
                                </Text>
                                <HStack gap={4}>
                                    <Button
                                        flex={1}
                                        bg={receivingTeam === 'home' ? 'blue.500' : 'transparent'}
                                        color={receivingTeam === 'home' ? 'white' : 'gray.300'}
                                        border="1px solid"
                                        borderColor={receivingTeam === 'home' ? 'blue.500' : 'gray.600'}
                                        _hover={{ bg: receivingTeam === 'home' ? 'blue.400' : 'gray.700' }}
                                        onClick={() => setReceivingTeam('home')}
                                    >
                                        {homeTeamName}
                                    </Button>
                                    <Button
                                        flex={1}
                                        bg={receivingTeam === 'away' ? 'blue.500' : 'transparent'}
                                        color={receivingTeam === 'away' ? 'white' : 'gray.300'}
                                        border="1px solid"
                                        borderColor={receivingTeam === 'away' ? 'blue.500' : 'gray.600'}
                                        _hover={{ bg: receivingTeam === 'away' ? 'blue.400' : 'gray.700' }}
                                        onClick={() => setReceivingTeam('away')}
                                    >
                                        {awayTeamName}
                                    </Button>
                                </HStack>
                            </Box>

                            <Box>
                                <Text fontWeight="bold" mb={2} color="gray.300">
                                    Which goal will {homeTeamName} defend?
                                </Text>
                                <HStack gap={4}>
                                    <Button
                                        flex={1}
                                        bg={homeDefendingGoal === 'left' ? 'orange.500' : 'transparent'}
                                        color={homeDefendingGoal === 'left' ? 'white' : 'gray.300'}
                                        border="1px solid"
                                        borderColor={homeDefendingGoal === 'left' ? 'orange.500' : 'gray.600'}
                                        _hover={{ bg: homeDefendingGoal === 'left' ? 'orange.400' : 'gray.700' }}
                                        onClick={() => setHomeDefendingGoal('left')}
                                    >
                                        ← Left Goal
                                    </Button>
                                    <Button
                                        flex={1}
                                        bg={homeDefendingGoal === 'right' ? 'orange.500' : 'transparent'}
                                        color={homeDefendingGoal === 'right' ? 'white' : 'gray.300'}
                                        border="1px solid"
                                        borderColor={homeDefendingGoal === 'right' ? 'orange.500' : 'gray.600'}
                                        _hover={{ bg: homeDefendingGoal === 'right' ? 'orange.400' : 'gray.700' }}
                                        onClick={() => setHomeDefendingGoal('right')}
                                    >
                                        Right Goal →
                                    </Button>
                                </HStack>
                            </Box>

                            <Box bg="blue.900" p={3} borderRadius="md" border="1px solid" borderColor="blue.400">
                                <Text fontSize="sm" color="blue.200">
                                    <Text as="span" fontWeight="bold">Summary:</Text> {receivingTeam === 'home' ? homeTeamName : awayTeamName} will receive the kickoff. {homeTeamName} will defend the {homeDefendingGoal} goal.
                                </Text>
                            </Box>
                        </VStack>
                    </Box>
                    <Box px={6} py={4} borderTop="2px solid" borderColor="blue.400">
                        <Stack direction="row" gap={3}>
                            <Button
                                variant="ghost"
                                color="gray.200"
                                onClick={onClose}
                                flex={1}
                            >
                                Cancel
                            </Button>
                            <Button
                                bg="blue.500"
                                color="white"
                                _hover={{ bg: 'blue.400' }}
                                onClick={handleConfirm}
                                flex={1}
                                fontWeight="700"
                            >
                                ✓ Start Quarter 3
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Portal>
    );
};
