import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Feature, Map, MapBrowserEvent, View } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import Geometry from 'ol/geom/Geometry';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Modify } from 'ol/interaction';
import { ModifyEvent } from 'ol/interaction/Modify';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { getLength } from 'ol/sphere';
import { Circle, Fill, Icon, Stroke, Style } from 'ol/style';
import TestData from './boundary-data.model';
import { BoundaryModel } from './boundary.model';
import { FeatureModel, GeojsonModel } from './geojson.model';

const fieldStyle = new Style({
  fill: new Fill({
    color: 'rgba(0, 0, 0, 0.5)',
  }),
  stroke: new Stroke({
    color: 'white',
    width: 2,
  }),
});

const lineStyle = new Style({
  stroke: new Stroke({
    color: '#aa46be',
    width: 8,
  }),
});

const modifyStyle = new Style({
  image: new Circle({
    radius: 0,
  }),
});

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor() {}
  @ViewChild('viewMap', { static: true }) private viewMap: ElementRef;
  map: Map;
  layers: TileLayer<XYZ>[] = [];
  satellite = new TileLayer({
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    }),
  });

  boundaryVectorSource = new VectorSource({
    features: new GeoJSON().readFeatures(
      this.createMultiPolygonFromBoundary(TestData.boundary),
      {
        featureProjection: 'EPSG:3857',
      }
    ),
  });
  boundaryVectorLayer = new VectorLayer({
    source: this.boundaryVectorSource,
    style: fieldStyle,
  });

  lineVectorSource: VectorSource<Geometry> = new VectorSource({
    features: [],
  });
  lineVectorLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
    source: this.lineVectorSource,
  });

  modifyInteraction: Modify;

  lineStyleFunction = (feature, resolution) => {
    let geometry = feature.getGeometry() as LineString;
    let styles = [lineStyle];
    let startCoord = geometry.getFirstCoordinate();
    let endCoord = geometry.getLastCoordinate();
    geometry.forEachSegment((x, y) => {
      if (this.coordinatesMatch(x, startCoord)) {
        let dy = y[1] - x[1];
        let dx = y[0] - x[0];
        let angle = Math.atan(dy / dx);
        let rotation = dx > 0 ? -(Math.PI / 2) + angle : Math.PI / 2 + angle;
        styles.push(
          new Style({
            geometry: new Point(x),
            image: new Icon({
              src: '/assets/caret.svg',
              rotation: -rotation,
              scale: 0.025,
              color: 'black',
            }),
          })
        );
      }
      if (this.coordinatesMatch(y, endCoord)) {
        let dy = x[1] - y[1];
        let dx = x[0] - y[0];
        let angle = Math.atan(dy / dx);
        let rotation = dx > 0 ? -(Math.PI / 2) + angle : Math.PI / 2 + angle;
        styles.push(
          new Style({
            geometry: new Point(y),
            image: new Icon({
              src: '/assets/caret.svg',
              rotation: -rotation,
              scale: 0.025,
              color: 'black',
            }),
          })
        );
      }
    });
    return styles;
  };

  ngOnInit(): void {
    setTimeout(() => this.map?.updateSize());
  }

  ngOnDestroy(): void {}

  ngAfterViewInit(): void {
    this.layers.push(this.satellite);
    this.map = new Map({
      interactions: [],
      target: this.viewMap.nativeElement,
      layers: this.layers,
      overlays: [],
      view: new View({
        center: fromLonLat([-101.320426, 42.041532]),
        zoom: 4,
      }),
    });
    this.map.addLayer(this.boundaryVectorLayer);
    this.createLines();
    this.map.addLayer(this.lineVectorLayer);
    this.map.getView().fit(this.boundaryVectorSource.getExtent(), {
      size: this.map.getSize(),
      padding: [25, 25, 25, 25],
    });
    this.modifyInteraction = new Modify({
      source: this.lineVectorSource,
      condition: this.modifyCondition,
      snapToPointer: true,
      style: modifyStyle,
    });
    this.map.addInteraction(this.modifyInteraction);
    this.modifyInteraction.setActive(true);
    this.modifyInteraction.on('modifyend', (e) => {
      this.snapLineToBoundary(e);
    });
  }

  modifyCondition = (e: MapBrowserEvent<any>) => {
    let condition = false;
    let lineFeature = this.lineVectorSource.getClosestFeatureToCoordinate(
      e.coordinate
    );
    let closestPointToCurrent = (
      lineFeature.getGeometry() as LineString
    ).getClosestPoint(e.coordinate);
    let currentStartPoint = (
      lineFeature.getGeometry() as LineString
    ).getCoordinates()[0];
    let currentEndPoint = (
      lineFeature.getGeometry() as LineString
    ).getCoordinates()[
      (lineFeature.getGeometry() as LineString).getCoordinates().length - 1
    ];
    if (
      this.coordinatesMatch(closestPointToCurrent, currentStartPoint) ||
      this.coordinatesMatch(closestPointToCurrent, currentEndPoint)
    ) {
      condition = true;
    }
    return condition;
  };

  createLines() {
    let exteriorRings = TestData.boundary.polygons.map(
      (p) => p.rings.filter((r) => r.exterior)[0].ring
    );
    let i: number = 0;
    exteriorRings.forEach((ring) => {
      let lineFeature: Feature<Geometry> = new Feature({
        geometry: new LineString(
          ring.slice(0, ring.length / 2).map((c) => fromLonLat(c))
        ),
      });
      lineFeature.setStyle(this.lineStyleFunction);
      lineFeature.setProperties({ index: i });
      this.lineVectorSource.addFeature(lineFeature);
      i++;
    });
  }

  snapLineToBoundary(e: ModifyEvent) {
    e.features.getArray().forEach((feature) => {
      let currentFeature = this.lineVectorSource
        .getFeatures()
        .find((f) => f.getProperties().index == feature.getProperties().index);
      this.lineVectorSource.removeFeature(currentFeature);
      let outerBoundary = TestData.boundary.polygons.map(
        (p) => p.rings[0].ring
      )[currentFeature.getProperties().index];
      let arrayOfCoordinates: number[][] = (
        currentFeature.getGeometry() as LineString
      ).getCoordinates();
      let newStartPoint = (
        currentFeature.getGeometry() as LineString
      ).getFirstCoordinate();
      let newEndPoint = (
        currentFeature.getGeometry() as LineString
      ).getLastCoordinate();
      let idx1: number = outerBoundary.indexOf(
        this.findClosestPointFromBoundary(
          toLonLat(newStartPoint),
          outerBoundary
        )
      );
      let idx2: number = outerBoundary.indexOf(
        this.findClosestPointFromBoundary(toLonLat(newEndPoint), outerBoundary)
      );
      console.log(idx1, idx2);
      if (idx2 > idx1) {
        arrayOfCoordinates = outerBoundary.slice(idx1, idx2).map((c) => {
          return fromLonLat(c);
        });
      } else {
        arrayOfCoordinates = [
          ...outerBoundary.slice(idx1, outerBoundary.length),
          ...outerBoundary.slice(0, idx2),
        ].map((c) => {
          return fromLonLat(c);
        });
      }
      (currentFeature.getGeometry() as LineString).setCoordinates(
        arrayOfCoordinates
      );
      this.lineVectorSource.addFeature(currentFeature);
    });
  }

  findClosestPointFromBoundary(point: number[], outerBoundary: number[][]) {
    return outerBoundary.reduce((prev, curr) => {
      return getLength(new LineString([curr, point])) <
        getLength(new LineString([prev, point]))
        ? curr
        : prev;
    });
  }

  createMultiPolygonFromBoundary(boundary: BoundaryModel) {
    let features: FeatureModel[] = [];
    boundary.polygons.forEach((polygon) => {
      let coordinates: any[] = [];
      polygon.rings.forEach((ring) => {
        coordinates.push(ring.ring);
      });
      let feature: FeatureModel = {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [coordinates],
        },
        properties: null,
      };
      features.push(feature);
    });
    return {
      type: 'FeatureCollection',
      features: features,
    } as GeojsonModel;
  }

  coordinatesMatch(coordinate1: number[], coordinate2: number[]): boolean {
    return coordinate1[0] == coordinate2[0] && coordinate1[1] == coordinate2[1];
  }
}
