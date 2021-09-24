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
import { defaults, Modify, Select } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
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

const select = new Select({});

const modify = new Modify({
  features: select.getFeatures(),
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

  ngOnInit(): void {
    setTimeout(() => this.map?.updateSize());
  }

  ngOnDestroy(): void {}

  ngAfterViewInit(): void {
    this.layers.push(this.satellite);
    this.map = new Map({
      interactions: defaults().extend([select, modify]),
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

    let outerBoundary = TestData.boundary.polygons.map(
      (p) => p.rings[0].ring
    )[0];

    this.addLayer(
      this.createMultiLineStringFromPoints(
        outerBoundary.slice(0, Math.round(outerBoundary.length / 2))
      ),
      lineStyle,
      false
    );

    // this.map.on('click', (e: any) => {
    //   let outerBoundary = TestData.boundary.polygons.map(
    //     (p) => p.rings[0].ring
    //   )[0];

    //   this.makeLinestring(
    //     this.findClosestPointFromBoundary(
    //       toLonLat(e.coordinate),
    //       outerBoundary
    //     ),
    //     outerBoundary
    //   );
    // });
  }

  // findClosestPointFromBoundary(point: number[], outerBoundary: number[][]) {
  //   return outerBoundary.reduce((prev, curr) => {
  //     return Math.abs(curr[0] - point[0]) < Math.abs(prev[0] - point[0]) &&
  //       Math.abs(curr[1] - point[1]) < Math.abs(prev[1] - point[1])
  //       ? curr
  //       : prev;
  //   });
  // }

  // makeLinestring(correctPoint: number[], outerBoundary: number[][]) {
  //   let index1: number = outerBoundary.indexOf(
  //     this.collectedPoints[this.collectedPoints.length - 1]
  //   );
  //   let index2: number = outerBoundary.indexOf(correctPoint);
  //   if (this.collectedPoints.length == 1) {
  //     this.drawingClockwise = index2 > index1;
  //   }
  //   if (this.collectedPoints.length) {
  //     if (this.drawingClockwise) {
  //       this.collectedPoints.push(...outerBoundary.slice(index1 + 1, index2));
  //     } else {
  //       console.log('index1: ', index1, 'index2: ', index2);
  //       if (index1 > index2) {
  //         console.log('reverse slice');
  //         this.collectedPoints.push(...outerBoundary.slice(index2 + 1, index1));
  //       } else {
  //         console.log('two lists');
  //         let list1 = outerBoundary.slice(index2, outerBoundary.length - 1);
  //         let list2 = outerBoundary.slice(0, index1);
  //         console.log(
  //           'list1: ',
  //           list1.map((l) => outerBoundary.indexOf(l))
  //         );
  //         console.log(
  //           'list2: ',
  //           list2.map((l) => outerBoundary.indexOf(l))
  //         );
  //         this.collectedPoints.push(...list1);
  //         this.collectedPoints.push(...list2);
  //       }
  //       // this.collectedPoints.push(...outerBoundary.slice(index2 + 1, index1));
  //     }
  //   }
  //   this.collectedPoints.push(correctPoint);
  //   if (this.collectedPoints.length > 1) {
  //     this.addLayer(
  //       this.createMultiLineStringFromPoints(this.collectedPoints),
  //       lineStyle,
  //       false
  //     );
  //   }
  // }

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
