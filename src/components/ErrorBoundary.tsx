import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Center, Heading, Stack, Text } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React component errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console (could also send to error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Center minH="60vh" p={6}>
          <Stack align="center" gap={4} maxW="600px" textAlign="center">
            <Heading size="lg" color="red.500">
              Something went wrong
            </Heading>
            <Text color="text.secondary">
              An unexpected error occurred. The error has been logged and you can try refreshing the page.
            </Text>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                w="100%"
                p={4}
                bg="red.50"
                borderRadius="md"
                border="1px solid"
                borderColor="red.200"
                textAlign="left"
              >
                <Text fontSize="sm" fontWeight="600" color="red.700" mb={2}>
                  Error Details (Development Only):
                </Text>
                <Text fontSize="xs" fontFamily="mono" color="red.600" whiteSpace="pre-wrap">
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text fontSize="xs" fontFamily="mono" color="red.600" mt={2} whiteSpace="pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </Box>
            )}

            <Stack direction="row" gap={3}>
              <Button
                bg="brand.primary"
                color="white"
                onClick={() => window.location.reload()}
                _hover={{ opacity: 0.9 }}
              >
                Refresh Page
              </Button>
              <Button
                variant="outline"
                borderColor="brand.primary"
                color="brand.primary"
                onClick={this.handleReset}
              >
                Try Again
              </Button>
            </Stack>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary for smaller sections.
 * Shows a more compact error message inline.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('SectionErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box p={4} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
          <Stack gap={2}>
            <Text fontWeight="600" color="red.700">
              Section Error
            </Text>
            <Text fontSize="sm" color="red.600">
              This section encountered an error. Try refreshing or contact support if the issue persists.
            </Text>
            <Button
              size="sm"
              variant="outline"
              borderColor="red.500"
              color="red.600"
              onClick={this.handleReset}
              alignSelf="flex-start"
            >
              Retry
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
