import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Feature, Map, View } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import { Modify, Snap } from 'ol/interaction';
import { ModifyEvent } from 'ol/interaction/Modify';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Fill, Icon, Stroke, Style } from 'ol/style';
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

const pointStyle = new Style({
  image: new Icon({
    color: '#aa46be',
    src: '/assets/map-marker-alt.png',
    scale: 0.075,
    anchor: [0.5, 1],
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
  isDrawing: boolean = false;
  geomtry: any;
  collectedPoints: number[][] = [];
  drawingClockwise: boolean;
  startPointFeature: Feature<Geometry> = new Feature({
    geometry: new Point(
      fromLonLat(TestData.boundary.polygons.map((p) => p.rings[0].ring)[0][0])
    ),
  });
  endPointFeature: Feature<Geometry> = new Feature({
    geometry: new Point(
      fromLonLat(
        TestData.boundary.polygons.map((p) => p.rings[0].ring)[0][
          Math.round(
            TestData.boundary.polygons.map((p) => p.rings[0].ring)[0].length / 2
          )
        ]
      )
    ),
  });
  pointsVectorSource: VectorSource<Geometry> = new VectorSource({
    features: [this.startPointFeature, this.endPointFeature],
  });
  pointsVectorLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
    source: this.pointsVectorSource,
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
  modifyInteraction: Modify;
  snapInteraction: Snap;

  ngOnInit(): void {
    setTimeout(() => this.map?.updateSize());
  }

  ngOnDestroy(): void {}

  ngAfterViewInit(): void {
    this.layers.push(this.satellite);
    this.startPointFeature.setStyle(pointStyle);
    this.endPointFeature.setStyle(pointStyle);
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
    this.map.addLayer(this.pointsVectorLayer);
    this.map.getView().fit(this.boundaryVectorSource.getExtent(), {
      size: this.map.getSize(),
      padding: [25, 25, 25, 25],
    });

    this.modifyInteraction = new Modify({
      hitDetection: this.pointsVectorLayer,
      source: this.pointsVectorSource,
    });
    this.map.addInteraction(this.modifyInteraction);
    this.modifyInteraction.setActive(true);
    this.modifyInteraction.on('modifyend', (e: ModifyEvent) => {
      let outerBoundary = TestData.boundary.polygons.map(
        (p) => p.rings[0].ring
      )[0];
      let currentPoints: number[][] = this.pointsVectorSource
        .getFeatures()
        .map((feature: Feature<Geometry>) => {
          return this.findClosestPointFromBoundary(
            toLonLat((feature.getGeometry() as Point).getCoordinates()),
            outerBoundary
          );
        });
      let idx1: number = outerBoundary.indexOf(currentPoints[0]);
      let idx2: number = outerBoundary.indexOf(currentPoints[1]);
      let sum1: number = idx2 - idx1;
      let sum2: number = idx1 + (outerBoundary.length - idx2);
      if (sum1 < sum2) {
        this.addLayer(
          this.createMultiLineStringFromPoints(outerBoundary.slice(idx1, idx2)),
          lineStyle,
          false
        );
      } else {
        this.addLayer(
          this.createMultiLineStringFromPoints([
            ...outerBoundary.slice(0, idx1),
            ...outerBoundary.slice(idx2, outerBoundary.length),
          ]),
          lineStyle,
          false
        );
      }
    });
  }

  findClosestPointFromBoundary(point: number[], outerBoundary: number[][]) {
    return outerBoundary.reduce((prev, curr) => {
      return Math.abs(curr[0] - point[0]) < Math.abs(prev[0] - point[0]) &&
        Math.abs(curr[1] - point[1]) < Math.abs(prev[1] - point[1])
        ? curr
        : prev;
    });
  }

  createMultiLineStringFromPoints(points: number[][]) {
    let features: any[] = [];
    let feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points,
      },
      properties: null,
    };
    features.push(feature);
    return {
      type: 'FeatureCollection',
      features: features,
    } as GeojsonModel;
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

  addLayer(geojson: GeojsonModel, style: Style, zoomToFeature: boolean) {
    console.log('geojson: ', geojson);
    let vec = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      }),
    });
    let vecLayer = new VectorLayer({
      source: vec,
      style: style,
    });
    this.map.addLayer(vecLayer);
    if (zoomToFeature) {
      this.map.getView().fit(vec.getExtent(), {
        size: this.map.getSize(),
        padding: [25, 25, 25, 25],
      });
    }
  }
}
