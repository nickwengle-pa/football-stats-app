import { useState, useCallback } from 'react';

export type TeamSide = 'home' | 'away';
export type FieldDirection = 'left-to-right' | 'right-to-left';

export interface UseGamePossessionProps {
    initialPossession?: TeamSide;
    initialFieldPosition?: number;
    initialDown?: number;
    initialYardsToGo?: number;
    initialDirection?: FieldDirection;
    timeRemaining: number; // Needed for TOP calculation
}

export const useGamePossession = ({
    initialPossession = 'home',
    initialFieldPosition = 25,
    initialDown = 1,
    initialYardsToGo = 10,
    initialDirection = 'left-to-right',
    timeRemaining,
}: UseGamePossessionProps) => {
    const [possession, setPossession] = useState<TeamSide>(initialPossession);
    const [fieldPosition, setFieldPosition] = useState<number>(initialFieldPosition);
    const [down, setDown] = useState<number>(initialDown);
    const [yardsToGo, setYardsToGo] = useState<number>(initialYardsToGo);
    const [direction, setDirection] = useState<FieldDirection>(initialDirection);

    // Time of Possession tracking
    const [homeTopSeconds, setHomeTopSeconds] = useState<number>(0);
    const [awayTopSeconds, setAwayTopSeconds] = useState<number>(0);
    const [possessionClockStart, setPossessionClockStart] = useState<number>(timeRemaining);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const recordPossessionTime = useCallback((currentSide: TeamSide, currentTimeRemaining: number) => {
        const delta = Math.max(0, possessionClockStart - currentTimeRemaining);
        if (delta > 0) {
            if (currentSide === 'home') {
                setHomeTopSeconds((prev) => prev + delta);
            } else {
                setAwayTopSeconds((prev) => prev + delta);
            }
        }
        setPossessionClockStart(currentTimeRemaining);
    }, [possessionClockStart]);

    const advanceBall = useCallback(() => {
        // Home team attacks toward 100 when left-to-right, toward 0 when right-to-left
        // Away team attacks toward 0 when left-to-right, toward 100 when right-to-left
        const shouldIncrease =
            (possession === 'home' && direction === 'left-to-right') ||
            (possession === 'away' && direction === 'right-to-left');

        const newPosition = shouldIncrease ? fieldPosition + 1 : fieldPosition - 1;
        setFieldPosition(clamp(newPosition, 0, 100));
    }, [possession, direction, fieldPosition]);

    const retreatBall = useCallback(() => {
        // Home team retreats toward 0 when left-to-right, toward 100 when right-to-left
        // Away team retreats toward 100 when left-to-right, toward 0 when right-to-left
        const shouldIncrease =
            (possession === 'home' && direction === 'right-to-left') ||
            (possession === 'away' && direction === 'left-to-right');

        const newPosition = shouldIncrease ? fieldPosition + 1 : fieldPosition - 1;
        setFieldPosition(clamp(newPosition, 0, 100));
    }, [possession, direction, fieldPosition]);

    const changePossession = useCallback((
        newFieldPosition?: number,
        preserveDirection: boolean = false,
        overrideTimeRemaining?: number
    ) => {
        const currentTime = overrideTimeRemaining !== undefined ? overrideTimeRemaining : timeRemaining;

        // Record time for the team losing possession
        recordPossessionTime(possession, currentTime);

        const newPossession = possession === 'home' ? 'away' : 'home';
        const newDir = preserveDirection ? direction : (direction === 'left-to-right' ? 'right-to-left' : 'left-to-right');
        const nextFieldPos = typeof newFieldPosition === 'number' ? clamp(newFieldPosition, 0, 100) : fieldPosition;

        setPossession(newPossession);
        setDirection(newDir);
        setDown(1);
        setYardsToGo(10);
        setFieldPosition(nextFieldPos);

        // Reset clock start for new possession
        setPossessionClockStart(currentTime);

        return {
            possession: newPossession,
            direction: newDir,
            fieldPosition: nextFieldPos,
            down: 1,
            yardsToGo: 10,
        };
    }, [possession, direction, fieldPosition, timeRemaining, recordPossessionTime]);

    const swapDirection = useCallback(() => {
        setDirection((prev) => (prev === 'left-to-right' ? 'right-to-left' : 'left-to-right'));
    }, []);

    return {
        possession,
        setPossession,
        fieldPosition,
        setFieldPosition,
        down,
        setDown,
        yardsToGo,
        setYardsToGo,
        direction,
        setDirection,
        homeTopSeconds,
        awayTopSeconds,
        advanceBall,
        retreatBall,
        changePossession,
        swapDirection,
        recordPossessionTime,
        possessionClockStart,
        setPossessionClockStart, // Exposed for manual resets (e.g. quarter change)
        setHomeTopSeconds,
        setAwayTopSeconds,
    };
};
