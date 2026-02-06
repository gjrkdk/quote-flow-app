import React, { useState, useCallback } from 'react';
import root from 'react-shadow';
import { usePriceFetch } from './hooks/usePriceFetch';
import { useDraftOrder } from './hooks/useDraftOrder';
import { DimensionInput } from './components/DimensionInput';
import { PriceDisplay } from './components/PriceDisplay';
import { QuantitySelector } from './components/QuantitySelector';
import { AddToCartButton } from './components/AddToCartButton';
import { widgetStyles } from './styles';
import type { PriceMatrixWidgetProps, AddToCartEvent } from './types';

/**
 * PriceMatrixWidget - Drop-in React component for dimension-based pricing.
 *
 * Renders inside Shadow DOM for CSS isolation.
 * Customer enters width/height, sees live price, adjusts quantity, and adds to cart.
 * Creates Shopify Draft Order and redirects to checkout.
 *
 * @example
 * ```tsx
 * <PriceMatrixWidget
 *   apiUrl="https://your-app.example.com"
 *   apiKey="pm_abc123"
 *   productId="gid://shopify/Product/123"
 *   theme={{ primaryColor: '#ff6b6b' }}
 *   onAddToCart={(event) => console.log('Added to cart:', event)}
 * />
 * ```
 */
export function PriceMatrixWidget(props: PriceMatrixWidgetProps) {
  const { apiUrl, apiKey, productId, theme, onAddToCart } = props;

  // Quantity state (default 1)
  const [quantity, setQuantity] = useState(1);

  // Price fetching hook (includes width/height state)
  const {
    width,
    height,
    setWidth,
    setHeight,
    price,
    total,
    loading: priceLoading,
    error: priceError,
    currency,
    unit,
    dimensionRange,
  } = usePriceFetch({ apiUrl, apiKey, productId }, quantity);

  // Draft Order creation hook
  const { createDraftOrder, creating, error: draftOrderError } = useDraftOrder({ apiUrl, apiKey });

  // Client-side dimension validation
  const widthNum = parseFloat(width);
  const heightNum = parseFloat(height);

  const widthError = (() => {
    if (!width) return null;
    if (isNaN(widthNum) || widthNum <= 0) return 'Must be a positive number';
    if (dimensionRange && widthNum < dimensionRange.minWidth) {
      return `Minimum ${dimensionRange.minWidth}${unit || ''}`;
    }
    if (dimensionRange && widthNum > dimensionRange.maxWidth) {
      return `Maximum ${dimensionRange.maxWidth}${unit || ''}`;
    }
    return null;
  })();

  const heightError = (() => {
    if (!height) return null;
    if (isNaN(heightNum) || heightNum <= 0) return 'Must be a positive number';
    if (dimensionRange && heightNum < dimensionRange.minHeight) {
      return `Minimum ${dimensionRange.minHeight}${unit || ''}`;
    }
    if (dimensionRange && heightNum > dimensionRange.maxHeight) {
      return `Maximum ${dimensionRange.maxHeight}${unit || ''}`;
    }
    return null;
  })();

  // Add to Cart handler
  const handleAddToCart = useCallback(async () => {
    // Shouldn't happen (button should be disabled), but defensive check
    if (!total || widthError || heightError || creating) return;

    try {
      const result = await createDraftOrder({
        productId,
        width: widthNum,
        height: heightNum,
        quantity,
      });

      // Fire onAddToCart callback if provided
      if (onAddToCart) {
        const event: AddToCartEvent = {
          draftOrderId: result.draftOrderId,
          checkoutUrl: result.checkoutUrl,
          price: result.price,
          total: parseFloat(result.total),
          dimensions: {
            width: widthNum,
            height: heightNum,
            unit: result.dimensions.unit,
          },
          quantity,
        };
        onAddToCart(event);
      }

      // Redirect to Shopify checkout
      window.location.href = result.checkoutUrl;
    } catch (err) {
      // Error state is already set by useDraftOrder hook
      console.error('Failed to create Draft Order:', err);
    }
  }, [
    total,
    widthError,
    heightError,
    creating,
    createDraftOrder,
    productId,
    widthNum,
    heightNum,
    quantity,
    onAddToCart,
  ]);

  // Map theme prop to CSS custom properties
  const themeStyles: Record<string, string> = {};
  if (theme?.primaryColor) themeStyles['--pm-primary-color'] = theme.primaryColor;
  if (theme?.textColor) themeStyles['--pm-text-color'] = theme.textColor;
  if (theme?.borderColor) themeStyles['--pm-border-color'] = theme.borderColor;
  if (theme?.borderRadius) themeStyles['--pm-border-radius'] = theme.borderRadius;
  if (theme?.fontSize) themeStyles['--pm-font-size'] = theme.fontSize;
  if (theme?.errorColor) themeStyles['--pm-error-color'] = theme.errorColor;

  // Button should be disabled when:
  // - No price loaded yet
  // - Dimensions are invalid
  // - Draft Order is being created
  const isAddToCartDisabled = !total || !!widthError || !!heightError || creating;

  return (
    <root.div style={themeStyles}>
      <style>{widgetStyles}</style>
      <div className="pm-widget">
        <DimensionInput
          label="Width"
          value={width}
          onChange={setWidth}
          unit={unit}
          min={dimensionRange?.minWidth ?? null}
          max={dimensionRange?.maxWidth ?? null}
          error={widthError}
        />

        <DimensionInput
          label="Height"
          value={height}
          onChange={setHeight}
          unit={unit}
          min={dimensionRange?.minHeight ?? null}
          max={dimensionRange?.maxHeight ?? null}
          error={heightError}
        />

        <QuantitySelector quantity={quantity} onChange={setQuantity} />

        <PriceDisplay
          price={total}
          currency={currency}
          loading={priceLoading}
          error={priceError || draftOrderError}
        />

        <AddToCartButton
          onClick={handleAddToCart}
          disabled={isAddToCartDisabled}
          loading={creating}
        />
      </div>
    </root.div>
  );
}
