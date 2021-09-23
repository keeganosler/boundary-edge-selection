import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Map, View } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Fill, Stroke, Style } from 'ol/style';
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
    width: 4.5,
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

  ngOnInit(): void {
    setTimeout(() => this.map?.updateSize());
  }

  ngOnDestroy(): void {}

  ngAfterViewInit(): void {
    this.layers.push(this.satellite);
    this.map = new Map({
      controls: [],
      target: this.viewMap.nativeElement,
      layers: this.layers,
      overlays: [],
      view: new View({
        center: fromLonLat([-101.320426, 42.041532]),
        zoom: 4,
      }),
    });

    this.addLayer(
      this.createMultiPolygonFromBoundary(TestData.boundary),
      fieldStyle,
      true
    );

    this.map.on('click', (e: any) => {
      let outerBoundary = TestData.boundary.polygons.map(
        (p) => p.rings[0].ring
      )[0];

      this.makeLinestring(
        this.findClosestPointFromBoundary(
          toLonLat(e.coordinate),
          outerBoundary
        ),
        outerBoundary
      );
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

  makeLinestring(correctPoint: number[], outerBoundary: number[][]) {
    if (this.collectedPoints.length) {
      this.collectedPoints.push(
        ...outerBoundary.slice(
          outerBoundary.indexOf(
            this.collectedPoints[this.collectedPoints.length - 1]
          ) + 1,
          outerBoundary.indexOf(correctPoint)
        )
      );
    }
    this.collectedPoints.push(correctPoint);
    if (this.collectedPoints.length > 1) {
      this.addLayer(
        this.createMultiLineStringFromPoints(this.collectedPoints),
        lineStyle,
        false
      );
    }
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
    let vec = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      }),
    });
    this.geomtry = vec;
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
