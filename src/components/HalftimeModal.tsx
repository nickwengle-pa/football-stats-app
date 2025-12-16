import React, { useState } from 'react';
import {
    Box,
    Button,
    Heading,
    HStack,
    Text,
    VStack,
} from '@chakra-ui/react';
import {
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogBackdrop,
} from './ui/dialog';

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

    return (
        <DialogRoot open={isOpen} onOpenChange={(e: { open: boolean }) => !e.open && onClose()} placement="center" closeOnInteractOutside={false}>
            <DialogBackdrop />
            <DialogContent bg="gray.900" color="white">
                <DialogHeader>Start 3rd Quarter</DialogHeader>
                <DialogBody>
                    <VStack align="stretch" gap={6}>
                        <Box>
                            <Text fontWeight="bold" mb={2} color="gray.300">
                                Who will receive the kickoff?
                            </Text>
                            <HStack gap={4}>
                                <Button
                                    flex={1}
                                    variant={receivingTeam === 'home' ? 'solid' : 'outline'}
                                    colorPalette={receivingTeam === 'home' ? 'blue' : 'gray'}
                                    onClick={() => setReceivingTeam('home')}
                                >
                                    {homeTeamName}
                                </Button>
                                <Button
                                    flex={1}
                                    variant={receivingTeam === 'away' ? 'solid' : 'outline'}
                                    colorPalette={receivingTeam === 'away' ? 'blue' : 'gray'}
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
                                    variant={homeDefendingGoal === 'left' ? 'solid' : 'outline'}
                                    colorPalette={homeDefendingGoal === 'left' ? 'orange' : 'gray'}
                                    onClick={() => setHomeDefendingGoal('left')}
                                >
                                    Left Goal
                                </Button>
                                <Button
                                    flex={1}
                                    variant={homeDefendingGoal === 'right' ? 'solid' : 'outline'}
                                    colorPalette={homeDefendingGoal === 'right' ? 'orange' : 'gray'}
                                    onClick={() => setHomeDefendingGoal('right')}
                                >
                                    Right Goal
                                </Button>
                            </HStack>
                        </Box>

                        <Box bg="blue.900" p={3} borderRadius="md">
                            <Text fontSize="sm">
                                <Text as="span" fontWeight="bold">Summary:</Text> {receivingTeam === 'home' ? homeTeamName : awayTeamName} will receive. {homeTeamName} will defend the {homeDefendingGoal} goal.
                            </Text>
                        </Box>
                    </VStack>
                </DialogBody>

                <DialogFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorPalette="blue" onClick={handleConfirm}>
                        Start Quarter 3
                    </Button>
                </DialogFooter>
            </DialogContent>
        </DialogRoot>
    );
};
