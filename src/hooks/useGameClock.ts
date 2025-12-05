import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseGameClockProps {
    initialTime?: number; // in seconds
    onTimeExpire?: () => void;
}

export const useGameClock = ({ initialTime = 12 * 60, onTimeExpire }: UseGameClockProps = {}) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(initialTime);
    const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
    const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isClockRunning) {
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
                clockIntervalRef.current = null;
            }
            return;
        }

        clockIntervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    setIsClockRunning(false);
                    if (onTimeExpire) onTimeExpire();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
                clockIntervalRef.current = null;
            }
        };
    }, [isClockRunning, onTimeExpire]);

    const startClock = useCallback(() => setIsClockRunning(true), []);
    const stopClock = useCallback(() => setIsClockRunning(false), []);
    const resetClock = useCallback((newTime: number = 12 * 60) => {
        setTimeRemaining(newTime);
        setIsClockRunning(false);
    }, []);

    const formatClock = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const adjustTime = useCallback((deltaSeconds: number) => {
        setTimeRemaining((prev) => Math.max(0, prev + deltaSeconds));
    }, []);

    return {
        timeRemaining,
        setTimeRemaining,
        isClockRunning,
        startClock,
        stopClock,
        resetClock,
        formatClock,
        adjustTime,
    };
};
