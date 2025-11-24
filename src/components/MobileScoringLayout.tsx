import React from 'react';
import { Box, Grid, GridItem, VStack, HStack } from '@chakra-ui/react';

interface MobileScoringLayoutProps {
  statsBoard: React.ReactNode;
  field: React.ReactNode;
  playControls: React.ReactNode;
  playByPlay: React.ReactNode;
  bottomActions: React.ReactNode;
}

/**
 * Mobile-optimized layout for iPad/iPhone scoring screen
 * 
 * Layouts:
 * - iPhone: Vertical stack with tabs
 * - iPad Portrait: 2-column with field priority
 * - iPad Landscape: 3-column like TurboStats
 */
export const MobileScoringLayout: React.FC<MobileScoringLayoutProps> = ({
  statsBoard,
  field,
  playControls,
  playByPlay,
  bottomActions,
}) => {
  return (
    <Box
      h="100vh"
      overflow="hidden"
      bg="bg.canvas"
      display="flex"
      flexDirection="column"
    >
      {/* Stats Board - Always at top, sticky */}
      <Box
        position="sticky"
        top="0"
        zIndex="sticky"
        bg="bg.canvas"
        pb={2}
      >
        {statsBoard}
      </Box>

      {/* Main Content Area - Scrollable */}
      <Box
        flex="1"
        overflow="auto"
        px={{ base: 2, md: 4 }}
      >
        {/* Responsive Grid Layout */}
        <Grid
          templateColumns={{
            base: '1fr', // iPhone: single column
            md: '1fr 1fr', // iPad portrait: 2 columns
            lg: '2fr 1fr', // iPad landscape: field larger
          }}
          gap={{ base: 3, md: 4 }}
          h="100%"
        >
          {/* Left Column: Field + Controls */}
          <GridItem>
            <VStack gap={{ base: 3, md: 4 }} h="100%">
              {/* Interactive Field */}
              <Box
                w="100%"
                borderRadius="lg"
                overflow="hidden"
                border="2px solid"
                borderColor="border.subtle"
                bg="white"
              >
                {field}
              </Box>

              {/* Play Result Buttons */}
              <Box w="100%">
                {playControls}
              </Box>
            </VStack>
          </GridItem>

          {/* Right Column: Play-by-Play (hidden on iPhone, shown on iPad) */}
          <GridItem display={{ base: 'none', md: 'block' }}>
            <Box
              h="100%"
              overflowY="auto"
              borderRadius="lg"
              border="1px solid"
              borderColor="border.subtle"
              bg="bg.surface"
            >
              {playByPlay}
            </Box>
          </GridItem>
        </Grid>

        {/* Play-by-Play for iPhone (below fold) */}
        <Box
          display={{ base: 'block', md: 'none' }}
          mt={4}
          borderRadius="lg"
          border="1px solid"
          borderColor="border.subtle"
          bg="bg.surface"
          maxH="400px"
          overflowY="auto"
        >
          {playByPlay}
        </Box>
      </Box>

      {/* Bottom Action Bar - Sticky, always accessible */}
      <Box
        position="sticky"
        bottom="0"
        zIndex="sticky"
        bg="bg.surface"
        borderTop="1px solid"
        borderColor="border.subtle"
        p={{ base: 2, md: 3 }}
        boxShadow="lg"
      >
        {bottomActions}
      </Box>
    </Box>
  );
};

/**
 * Alternative: Tabbed layout for iPhone when content is too dense
 */
interface TabLayoutProps {
  tabs: Array<{
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }>;
  activeTab: number;
  onTabChange: (index: number) => void;
}

export const TabbedMobileLayout: React.FC<TabLayoutProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Tab Content - Takes full height */}
      <Box flex="1" overflow="auto" p={{ base: 2, md: 4 }}>
        {tabs[activeTab]?.content}
      </Box>

      {/* Bottom Tab Bar - iOS style */}
      <HStack
        justify="space-around"
        bg="bg.surface"
        borderTop="1px solid"
        borderColor="border.subtle"
        py={2}
        boxShadow="lg"
        position="sticky"
        bottom="0"
      >
        {tabs.map((tab, index) => (
          <VStack
            key={index}
            gap={0}
            flex="1"
            cursor="pointer"
            onClick={() => onTabChange(index)}
            color={activeTab === index ? 'brand.primary' : 'text.secondary'}
            _active={{ transform: 'scale(0.95)' }}
            transition="all 0.15s"
            py={1}
          >
            {tab.icon && <Box fontSize="xl">{tab.icon}</Box>}
            <Box
              fontSize="2xs"
              fontWeight={activeTab === index ? '600' : '400'}
            >
              {tab.label}
            </Box>
          </VStack>
        ))}
      </HStack>
    </Box>
  );
};
