import React, { useState, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { HashMark } from '../models';

interface InteractiveFootballFieldProps {
  ballPosition: number; // 0-100 yard line
  hashMark?: HashMark;
  possession: 'home' | 'away';
  direction: 'left-to-right' | 'right-to-left';
  teamName: string;
  opponentName: string;
  onBallPositionChange?: (position: number, hash: HashMark) => void;
  interactive?: boolean;
  showYardNumbers?: boolean;
}

export const InteractiveFootballField: React.FC<InteractiveFootballFieldProps> = ({
  ballPosition,
  hashMark = 'middle',
  possession,
  direction,
  teamName,
  opponentName,
  onBallPositionChange,
  interactive = true,
  showYardNumbers = true,
}) => {
  const fieldRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle both mouse and touch events for iPad/iPhone
  const handleFieldInteraction = (clientX: number, clientY: number) => {
    if (!interactive || !onBallPositionChange) return;

    const svg = fieldRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert x to yard position (0-100)
    const yardPosition = Math.round((x / rect.width) * 100);
    const clampedYard = Math.max(0, Math.min(100, yardPosition));

    // Determine hash mark based on y position
    const fieldThird = rect.height / 3;
    let newHash: HashMark = 'middle';
    if (y < fieldThird) newHash = 'left';
    else if (y > fieldThird * 2) newHash = 'right';

    onBallPositionChange(clampedYard, newHash);
  };

  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    handleFieldInteraction(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsDragging(true);
    const touch = e.touches[0];
    handleFieldInteraction(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || !interactive) return;
    e.preventDefault(); // Prevent scrolling while dragging
    const touch = e.touches[0];
    handleFieldInteraction(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = () => {
    if (interactive) setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !interactive || !onBallPositionChange) return;
    handleFieldClick(e);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Calculate ball position on SVG (viewBox is 1000x300)
  const ballX = (ballPosition / 100) * 1000;
  const ballY = hashMark === 'left' ? 75 : hashMark === 'right' ? 225 : 150;

  // Determine end zone labels based on direction
  const leftLabel = direction === 'left-to-right' ? teamName.slice(0, 3).toUpperCase() : opponentName.slice(0, 3).toUpperCase();
  const rightLabel = direction === 'left-to-right' ? opponentName.slice(0, 3).toUpperCase() : teamName.slice(0, 3).toUpperCase();

  return (
    <Box
      w="100%"
      position="relative"
      cursor={interactive ? 'pointer' : 'default'}
      userSelect="none"
      // Touch-friendly styling
      touchAction={interactive ? 'none' : 'auto'}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <svg
        ref={fieldRef}
        viewBox="0 0 1000 300"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onClick={handleFieldClick}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Field background */}
        <rect x="0" y="0" width="1000" height="300" fill="#0a5c1a" />

        {/* End zones */}
        <rect x="0" y="0" width="50" height="300" fill="#1a4d2e" opacity="0.5" />
        <rect x="950" y="0" width="50" height="300" fill="#1a4d2e" opacity="0.5" />

        {/* End zone labels */}
        <text x="25" y="150" fill="white" fontSize="24" fontWeight="bold" textAnchor="middle" opacity="0.6">
          {leftLabel}
        </text>
        <text x="975" y="150" fill="white" fontSize="24" fontWeight="bold" textAnchor="middle" opacity="0.6">
          {rightLabel}
        </text>

        {/* Yard lines (every 10 yards) */}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((yard) => {
          const x = (yard / 100) * 900 + 50; // Offset by end zone width
          const isGoalLine = yard === 0 || yard === 100;
          const is50 = yard === 50;
          
          return (
            <g key={yard}>
              {/* Yard line */}
              <line
                x1={x}
                y1="0"
                x2={x}
                y2="300"
                stroke="white"
                strokeWidth={isGoalLine ? "3" : is50 ? "2" : "1"}
                opacity={isGoalLine ? "0.9" : "0.4"}
              />
              
              {/* Yard numbers */}
              {showYardNumbers && !isGoalLine && (
                <>
                  <text
                    x={x}
                    y="60"
                    fill="white"
                    fontSize="20"
                    fontWeight="bold"
                    textAnchor="middle"
                    opacity="0.6"
                  >
                    {yard === 50 ? '50' : yard < 50 ? yard : 100 - yard}
                  </text>
                  <text
                    x={x}
                    y="250"
                    fill="white"
                    fontSize="20"
                    fontWeight="bold"
                    textAnchor="middle"
                    opacity="0.6"
                  >
                    {yard === 50 ? '50' : yard < 50 ? yard : 100 - yard}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Hash marks */}
        <line x1="50" y1="75" x2="950" y2="75" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="10,10" />
        <line x1="50" y1="150" x2="950" y2="150" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="10,10" />
        <line x1="50" y1="225" x2="950" y2="225" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="10,10" />

        {/* Football at ball position - LARGER for touch screens */}
        <g transform={`translate(${ballX}, ${ballY})`}>
          {/* Ball shadow */}
          <ellipse cx="3" cy="3" rx="24" ry="15" fill="black" opacity="0.3" />
          
          {/* Football - 50% larger for mobile visibility */}
          <ellipse cx="0" cy="0" rx="24" ry="15" fill="#8B4513" stroke="#654321" strokeWidth="3" />
          
          {/* Laces - thicker for visibility */}
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="-9" y1="-5" x2="-9" y2="5" stroke="#FFFFFF" strokeWidth="1.5" />
          <line x1="-3" y1="-5" x2="-3" y2="5" stroke="#FFFFFF" strokeWidth="1.5" />
          <line x1="3" y1="-5" x2="3" y2="5" stroke="#FFFFFF" strokeWidth="1.5" />
          <line x1="9" y1="-5" x2="9" y2="5" stroke="#FFFFFF" strokeWidth="1.5" />
          
          {/* Touch target indicator - larger hit area */}
          {interactive && (
            <>
              <circle cx="0" cy="0" r="35" fill="yellow" opacity="0.15" />
              <circle cx="0" cy="0" r="25" fill="white" opacity="0.1" />
            </>
          )}
        </g>

        {/* Hash mark indicator */}
        {hashMark && (
          <text
            x={ballX}
            y={ballY - 25}
            fill="yellow"
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
          >
            {hashMark === 'left' ? 'L' : hashMark === 'right' ? 'R' : 'M'}
          </text>
        )}
      </svg>
      
      {/* Field position display */}
      <Box
        position="absolute"
        bottom="4"
        left="50%"
        transform="translateX(-50%)"
        bg="blackAlpha.800"
        px={3}
        py={1}
        borderRadius="md"
        border="1px solid"
        borderColor="whiteAlpha.400"
      >
        <Text fontSize="sm" fontWeight="700" color="white">
          {ballPosition === 50 ? '50' : ballPosition < 50 ? `${leftLabel} ${ballPosition}` : `${rightLabel} ${100 - ballPosition}`}
          {hashMark && ` • ${hashMark.toUpperCase()}`}
        </Text>
      </Box>
    </Box>
  );
};
