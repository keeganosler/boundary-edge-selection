export class GeojsonModel {
  type: string;
  features: FeatureModel[];
}

export class FeatureModel {
  public type: string;
  public geometry: GeometryModel;
  public properties: any;
}

export class GeometryModel {
  public type?: string;
  public coordinates?: number[][][][];
}
