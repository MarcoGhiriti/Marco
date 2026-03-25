import React from "react";
import { StyleSheet, View } from "react-native";

import { RouteMiniMap } from "./RouteMiniMap";

type Props = {
  polyline?: number[][];
  currentPoint?: { lat: number; lng: number } | null;
  stopPoints?: number[][];
  height?: number;
  dataTestId?: string;
};

export function InteractiveRouteMap({
  polyline = [],
  currentPoint,
  height = 220,
  dataTestId,
}: Props) {
  return (
    <View data-testid={dataTestId}>
      <RouteMiniMap polyline={polyline} lat={currentPoint?.lat} lng={currentPoint?.lng} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({});