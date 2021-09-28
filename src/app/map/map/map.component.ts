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
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Modify } from 'ol/interaction';
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

const pointStyle1 = new Style({
  image: new Icon({
    color: 'red',
    src: '/assets/map-marker-alt.png',
    scale: 0.075,
    anchor: [0.5, 0.5],
  }),
});
const pointStyle2 = new Style({
  image: new Icon({
    color: 'green',
    src: '/assets/map-marker-alt.png',
    scale: 0.075,
    anchor: [0.5, 0.5],
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

  startPointFeature: Feature<Geometry> = new Feature({
    geometry: new Point(
      fromLonLat(TestData.boundary.polygons.map((p) => p.rings[0].ring)[0][0])
    ),
    properties: {
      start: true,
      end: false,
    },
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
    properties: {
      start: false,
      end: true,
    },
  });
  pointsVectorSource: VectorSource<Geometry> = new VectorSource({
    features: [this.startPointFeature, this.endPointFeature],
  });
  pointsVectorLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
    source: this.pointsVectorSource,
    updateWhileInteracting: true,
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

  edgeLineFeature: Feature<Geometry> = new Feature({
    geometry: new LineString([]),
  });
  edgeLineVectorSource: VectorSource<Geometry> = new VectorSource({
    features: [this.edgeLineFeature],
  });
  edgeLineVectorLayer: VectorLayer<VectorSource<Geometry>> = new VectorLayer({
    source: this.edgeLineVectorSource,
  });

  modifyInteraction: Modify;

  ngOnInit(): void {
    setTimeout(() => this.map?.updateSize());
  }

  ngOnDestroy(): void {}

  ngAfterViewInit(): void {
    this.layers.push(this.satellite);
    this.startPointFeature.setStyle(pointStyle1);
    this.endPointFeature.setStyle(pointStyle2);
    this.edgeLineFeature.setStyle(lineStyle);
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
      source: this.pointsVectorSource,
    });
    this.map.addInteraction(this.modifyInteraction);
    this.modifyInteraction.setActive(true);
    this.modifyInteraction.on('modifyend', (e) => {
      this.snapToBoundaryLine();
    });
    this.map.on('pointerdrag', (e) => {
      this.updateLine();
    });
  }

  snapToBoundaryLine() {
    this.pointsVectorSource
      .getFeatures()
      .forEach((feature: Feature<Geometry>) => {
        let currentPoint = (feature.getGeometry() as Point).getCoordinates();
        let closestPoint = this.boundaryVectorSource
          .getClosestFeatureToCoordinate(currentPoint)
          .getGeometry()
          .getClosestPoint(currentPoint);
        (feature.getGeometry() as Point).setCoordinates(closestPoint);
      });
  }

  updateLine() {
    let outerBoundary = TestData.boundary.polygons.map(
      (p) => p.rings[0].ring
    )[0];
    let currentPoints: {
      feature: string;
      geojsonCoordinates: number[];
      boundaryCoordinates: number[];
    }[] = this.pointsVectorSource
      .getFeatures()
      .map((feature: Feature<Geometry>) => {
        return {
          feature: feature.getProperties().properties.start ? 'start' : 'end',
          geojsonCoordinates: this.boundaryVectorSource
            .getClosestFeatureToCoordinate(
              (feature.getGeometry() as Point).getCoordinates()
            )
            .getGeometry()
            .getClosestPoint((feature.getGeometry() as Point).getCoordinates()),
          boundaryCoordinates: this.findClosestPointFromBoundary(
            toLonLat((feature.getGeometry() as Point).getCoordinates()),
            outerBoundary
          ),
        };
      });
    let idx1: number = outerBoundary.indexOf(
      currentPoints.find((f) => f.feature == 'start').boundaryCoordinates
    );
    let idx2: number = outerBoundary.indexOf(
      currentPoints.find((f) => f.feature == 'end').boundaryCoordinates
    );
    this.map.removeLayer(this.edgeLineVectorLayer);
    let line: number[][];
    if (idx2 > idx1) {
      line = outerBoundary.slice(idx1 + 1, idx2);
    } else {
      line = [
        ...outerBoundary.slice(idx1, outerBoundary.length),
        ...outerBoundary.slice(0, idx2),
      ];
    }
    line[0] = toLonLat(
      currentPoints.find((f) => f.feature == 'start').geojsonCoordinates
    );
    line[line.length] = toLonLat(
      currentPoints.find((f) => f.feature == 'end').geojsonCoordinates
    );
    (this.edgeLineFeature.getGeometry() as LineString).setCoordinates(
      line.map((c) => {
        return fromLonLat(c);
      })
    );
    this.map.addLayer(this.edgeLineVectorLayer);
  }

  findClosestPointFromBoundary(point: number[], outerBoundary: number[][]) {
    return outerBoundary.reduce((prev, curr) => {
      return Math.abs(curr[0] - point[0]) < Math.abs(prev[0] - point[0]) &&
        Math.abs(curr[1] - point[1]) < Math.abs(prev[1] - point[1])
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
}
