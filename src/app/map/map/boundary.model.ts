export class BoundaryModel {
  public boundaryId: string;
  public name: string;
  public polygons: PolygonModel[];
  public error: string;
  public source: string;
  public fieldId: string;
  public irrigated: boolean;
  public archived: boolean;
  public createdAt: string;
  public modifiedAt: string;
}

export class PolygonModel {
  public name?: string;
  public rings: RingModel[];
  public error: string;
  public exclude?: boolean;
  public exportRequested: boolean;
}

export class RingModel {
  public exterior: boolean;
  public name: string;
  public passable?: boolean;
  public ring: number[][];
  public error: string;
  public exclude: boolean;
}
