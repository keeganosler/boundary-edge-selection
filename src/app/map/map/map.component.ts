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
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { getLength } from 'ol/sphere';
import { Circle, Fill, Stroke, Style } from 'ol/style';
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

const pointStyle = new Style({
  image: new Circle({
    radius: 14,
    fill: new Fill({
      color: '#aa46be',
    }),
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

  lineFeature: Feature<Geometry> = new Feature({
    geometry: new LineString(
      TestData.boundary.polygons
        .map((p) => p.rings[0].ring)[0]
        .slice(
          0,
          TestData.boundary.polygons.map((p) => p.rings[0].ring)[0].length / 2
        )
        .map((c) => {
          return fromLonLat(c);
        })
    ),
  });
  lineVectorSource: VectorSource<Geometry> = new VectorSource({
    features: [this.lineFeature],
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
      if (
        (x[0] == startCoord[0] && x[1] == startCoord[1]) ||
        (x[0] == endCoord[0] && x[1] == endCoord[1])
      ) {
        styles.push(
          new Style({
            geometry: new Point(x),
            image: new Circle({
              radius: 12,
              fill: new Fill({
                color: '#aa46be',
              }),
            }),
          })
        );
      }
      if (
        (y[0] == startCoord[0] && y[1] == startCoord[1]) ||
        (y[0] == endCoord[0] && y[1] == endCoord[1])
      ) {
        styles.push(
          new Style({
            geometry: new Point(y),
            image: new Circle({
              radius: 12,
              fill: new Fill({
                color: '#aa46be',
              }),
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
    this.startPointFeature.setStyle(pointStyle);
    this.endPointFeature.setStyle(pointStyle);
    //this.edgeLineFeature.setStyle(lineStyle);
    this.lineFeature.setStyle(this.lineStyleFunction);
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
    this.map.addLayer(this.lineVectorLayer);
    // this.map.addLayer(this.pointsVectorLayer);
    this.map.getView().fit(this.boundaryVectorSource.getExtent(), {
      size: this.map.getSize(),
      padding: [25, 25, 25, 25],
    });
    this.modifyInteraction = new Modify({
      //source: this.pointsVectorSource,
      source: this.lineVectorSource,
      condition: this.modifyCondition,
      snapToPointer: true,
      style: modifyStyle,
    });
    this.map.addInteraction(this.modifyInteraction);
    this.modifyInteraction.setActive(true);
    this.modifyInteraction.on('modifyend', (e) => {
      //this.snapPointsToBoundary();
      this.snapLineToBoundary();
    });
    this.map.on('pointerdrag', (e) => {
      //this.updateLineBetweenPoints();
    });
  }

  modifyCondition = (e: MapBrowserEvent<any>) => {
    let condition = false;
    let closestPointToCurrent = (
      this.lineFeature.getGeometry() as LineString
    ).getClosestPoint(e.coordinate);
    let currentStartPoint = (
      this.lineFeature.getGeometry() as LineString
    ).getCoordinates()[0];
    let currentEndPoint = (
      this.lineFeature.getGeometry() as LineString
    ).getCoordinates()[
      (this.lineFeature.getGeometry() as LineString).getCoordinates().length - 1
    ];

    if (
      (closestPointToCurrent[0] == currentStartPoint[0] &&
        closestPointToCurrent[1] == currentStartPoint[1]) ||
      (closestPointToCurrent[0] == currentEndPoint[0] &&
        closestPointToCurrent[1] == currentEndPoint[1])
    ) {
      condition = true;
    }
    return condition;
  };

  snapPointsToBoundary() {
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

  snapLineToBoundary() {
    this.map.removeLayer(this.lineVectorLayer);
    let outerBoundary = TestData.boundary.polygons.map(
      (p) => p.rings[0].ring
    )[0];
    let arrayOfCoordinates: number[][] = (
      this.lineFeature.getGeometry() as LineString
    ).getCoordinates();
    let newStartPoint = (
      this.lineFeature.getGeometry() as LineString
    ).getFirstCoordinate();
    let newEndPoint = (
      this.lineFeature.getGeometry() as LineString
    ).getLastCoordinate();
    let idx1: number = outerBoundary.indexOf(
      this.findClosestPointFromBoundary(toLonLat(newStartPoint), outerBoundary)
    );
    let idx2: number = outerBoundary.indexOf(
      this.findClosestPointFromBoundary(toLonLat(newEndPoint), outerBoundary)
    );
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
    arrayOfCoordinates[0] = this.boundaryVectorSource
      .getClosestFeatureToCoordinate(newStartPoint)
      .getGeometry()
      .getClosestPoint(newStartPoint);
    arrayOfCoordinates[arrayOfCoordinates.length - 1] =
      this.boundaryVectorSource
        .getClosestFeatureToCoordinate(newEndPoint)
        .getGeometry()
        .getClosestPoint(newEndPoint);

    (this.lineFeature.getGeometry() as LineString).setCoordinates(
      arrayOfCoordinates
    );
    this.map.addLayer(this.lineVectorLayer);
  }

  updateLineBetweenPoints() {
    let startPointIndex: number;
    let endPointIndex: number;
    let startPointCoordinates: number[];
    let endPointCoordinates: number[];
    let outerBoundary = TestData.boundary.polygons.map(
      (p) => p.rings[0].ring
    )[0];
    this.pointsVectorSource
      .getFeatures()
      .forEach((feature: Feature<Geometry>) => {
        let geojsonCoordinates = this.boundaryVectorSource
          .getClosestFeatureToCoordinate(
            (feature.getGeometry() as Point).getCoordinates()
          )
          .getGeometry()
          .getClosestPoint((feature.getGeometry() as Point).getCoordinates());
        let boundaryCoordinates = this.findClosestPointFromBoundary(
          toLonLat((feature.getGeometry() as Point).getCoordinates()),
          outerBoundary
        );
        if (feature.getProperties().properties.start) {
          startPointCoordinates = geojsonCoordinates;
          startPointIndex = outerBoundary.indexOf(boundaryCoordinates);
        } else {
          endPointCoordinates = geojsonCoordinates;
          endPointIndex = outerBoundary.indexOf(boundaryCoordinates);
        }
      });
    this.map.removeLayer(this.edgeLineVectorLayer);
    let line: number[][];
    if (endPointIndex > startPointIndex) {
      line = outerBoundary.slice(startPointIndex + 1, endPointIndex);
    } else {
      line = [
        ...outerBoundary.slice(startPointIndex, outerBoundary.length),
        ...outerBoundary.slice(0, endPointIndex),
      ];
    }
    line[0] = toLonLat(startPointCoordinates);
    line[line.length] = toLonLat(endPointCoordinates);
    (this.edgeLineFeature.getGeometry() as LineString).setCoordinates(
      line.map((c) => {
        return fromLonLat(c);
      })
    );
    this.map.addLayer(this.edgeLineVectorLayer);
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
}
