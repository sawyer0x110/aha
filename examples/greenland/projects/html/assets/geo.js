var Geo = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // geo-entry.js
  var geo_entry_exports = {};
  __export(geo_entry_exports, {
    geoArea: () => area_default,
    geoCentroid: () => centroid_default,
    geoEqualEarth: () => equalEarth_default,
    geoGraticule10: () => graticule10,
    geoMercator: () => mercator_default,
    geoOrthographic: () => orthographic_default,
    geoPath: () => path_default,
    geoRotation: () => rotation_default
  });

  // node_modules/d3-array/src/fsum.js
  var Adder = class {
    constructor() {
      this._partials = new Float64Array(32);
      this._n = 0;
    }
    add(x) {
      const p = this._partials;
      let i = 0;
      for (let j = 0; j < this._n && j < 32; j++) {
        const y = p[j], hi = x + y, lo = Math.abs(x) < Math.abs(y) ? x - (hi - y) : y - (hi - x);
        if (lo) p[i++] = lo;
        x = hi;
      }
      p[i] = x;
      this._n = i + 1;
      return this;
    }
    valueOf() {
      const p = this._partials;
      let n = this._n, x, y, lo, hi = 0;
      if (n > 0) {
        hi = p[--n];
        while (n > 0) {
          x = hi;
          y = p[--n];
          hi = x + y;
          lo = y - (hi - x);
          if (lo) break;
        }
        if (n > 0 && (lo < 0 && p[n - 1] < 0 || lo > 0 && p[n - 1] > 0)) {
          y = lo * 2;
          x = hi + y;
          if (y == x - hi) hi = x;
        }
      }
      return hi;
    }
  };

  // node_modules/d3-array/src/merge.js
  function* flatten(arrays) {
    for (const array of arrays) {
      yield* array;
    }
  }
  function merge(arrays) {
    return Array.from(flatten(arrays));
  }

  // node_modules/d3-array/src/range.js
  function range(start, stop, step) {
    start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;
    var i = -1, n = Math.max(0, Math.ceil((stop - start) / step)) | 0, range2 = new Array(n);
    while (++i < n) {
      range2[i] = start + i * step;
    }
    return range2;
  }

  // node_modules/d3-geo/src/math.js
  var epsilon = 1e-6;
  var epsilon2 = 1e-12;
  var pi = Math.PI;
  var halfPi = pi / 2;
  var quarterPi = pi / 4;
  var tau = pi * 2;
  var degrees = 180 / pi;
  var radians = pi / 180;
  var abs = Math.abs;
  var atan = Math.atan;
  var atan2 = Math.atan2;
  var cos = Math.cos;
  var ceil = Math.ceil;
  var exp = Math.exp;
  var hypot = Math.hypot;
  var log = Math.log;
  var sin = Math.sin;
  var sign = Math.sign || function(x) {
    return x > 0 ? 1 : x < 0 ? -1 : 0;
  };
  var sqrt = Math.sqrt;
  var tan = Math.tan;
  function acos(x) {
    return x > 1 ? 0 : x < -1 ? pi : Math.acos(x);
  }
  function asin(x) {
    return x > 1 ? halfPi : x < -1 ? -halfPi : Math.asin(x);
  }

  // node_modules/d3-geo/src/noop.js
  function noop() {
  }

  // node_modules/d3-geo/src/stream.js
  function streamGeometry(geometry, stream) {
    if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
      streamGeometryType[geometry.type](geometry, stream);
    }
  }
  var streamObjectType = {
    Feature: function(object, stream) {
      streamGeometry(object.geometry, stream);
    },
    FeatureCollection: function(object, stream) {
      var features = object.features, i = -1, n = features.length;
      while (++i < n) streamGeometry(features[i].geometry, stream);
    }
  };
  var streamGeometryType = {
    Sphere: function(object, stream) {
      stream.sphere();
    },
    Point: function(object, stream) {
      object = object.coordinates;
      stream.point(object[0], object[1], object[2]);
    },
    MultiPoint: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) object = coordinates[i], stream.point(object[0], object[1], object[2]);
    },
    LineString: function(object, stream) {
      streamLine(object.coordinates, stream, 0);
    },
    MultiLineString: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamLine(coordinates[i], stream, 0);
    },
    Polygon: function(object, stream) {
      streamPolygon(object.coordinates, stream);
    },
    MultiPolygon: function(object, stream) {
      var coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamPolygon(coordinates[i], stream);
    },
    GeometryCollection: function(object, stream) {
      var geometries = object.geometries, i = -1, n = geometries.length;
      while (++i < n) streamGeometry(geometries[i], stream);
    }
  };
  function streamLine(coordinates, stream, closed) {
    var i = -1, n = coordinates.length - closed, coordinate;
    stream.lineStart();
    while (++i < n) coordinate = coordinates[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
    stream.lineEnd();
  }
  function streamPolygon(coordinates, stream) {
    var i = -1, n = coordinates.length;
    stream.polygonStart();
    while (++i < n) streamLine(coordinates[i], stream, 1);
    stream.polygonEnd();
  }
  function stream_default(object, stream) {
    if (object && streamObjectType.hasOwnProperty(object.type)) {
      streamObjectType[object.type](object, stream);
    } else {
      streamGeometry(object, stream);
    }
  }

  // node_modules/d3-geo/src/area.js
  var areaRingSum = new Adder();
  var areaSum = new Adder();
  var lambda00;
  var phi00;
  var lambda0;
  var cosPhi0;
  var sinPhi0;
  var areaStream = {
    point: noop,
    lineStart: noop,
    lineEnd: noop,
    polygonStart: function() {
      areaRingSum = new Adder();
      areaStream.lineStart = areaRingStart;
      areaStream.lineEnd = areaRingEnd;
    },
    polygonEnd: function() {
      var areaRing = +areaRingSum;
      areaSum.add(areaRing < 0 ? tau + areaRing : areaRing);
      this.lineStart = this.lineEnd = this.point = noop;
    },
    sphere: function() {
      areaSum.add(tau);
    }
  };
  function areaRingStart() {
    areaStream.point = areaPointFirst;
  }
  function areaRingEnd() {
    areaPoint(lambda00, phi00);
  }
  function areaPointFirst(lambda, phi) {
    areaStream.point = areaPoint;
    lambda00 = lambda, phi00 = phi;
    lambda *= radians, phi *= radians;
    lambda0 = lambda, cosPhi0 = cos(phi = phi / 2 + quarterPi), sinPhi0 = sin(phi);
  }
  function areaPoint(lambda, phi) {
    lambda *= radians, phi *= radians;
    phi = phi / 2 + quarterPi;
    var dLambda = lambda - lambda0, sdLambda = dLambda >= 0 ? 1 : -1, adLambda = sdLambda * dLambda, cosPhi = cos(phi), sinPhi = sin(phi), k = sinPhi0 * sinPhi, u = cosPhi0 * cosPhi + k * cos(adLambda), v = k * sdLambda * sin(adLambda);
    areaRingSum.add(atan2(v, u));
    lambda0 = lambda, cosPhi0 = cosPhi, sinPhi0 = sinPhi;
  }
  function area_default(object) {
    areaSum = new Adder();
    stream_default(object, areaStream);
    return areaSum * 2;
  }

  // node_modules/d3-geo/src/cartesian.js
  function spherical(cartesian2) {
    return [atan2(cartesian2[1], cartesian2[0]), asin(cartesian2[2])];
  }
  function cartesian(spherical2) {
    var lambda = spherical2[0], phi = spherical2[1], cosPhi = cos(phi);
    return [cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi)];
  }
  function cartesianDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cartesianCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function cartesianAddInPlace(a, b) {
    a[0] += b[0], a[1] += b[1], a[2] += b[2];
  }
  function cartesianScale(vector, k) {
    return [vector[0] * k, vector[1] * k, vector[2] * k];
  }
  function cartesianNormalizeInPlace(d) {
    var l = sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    d[0] /= l, d[1] /= l, d[2] /= l;
  }

  // node_modules/d3-geo/src/centroid.js
  var W0;
  var W1;
  var X0;
  var Y0;
  var Z0;
  var X1;
  var Y1;
  var Z1;
  var X2;
  var Y2;
  var Z2;
  var lambda002;
  var phi002;
  var x0;
  var y0;
  var z0;
  var centroidStream = {
    sphere: noop,
    point: centroidPoint,
    lineStart: centroidLineStart,
    lineEnd: centroidLineEnd,
    polygonStart: function() {
      centroidStream.lineStart = centroidRingStart;
      centroidStream.lineEnd = centroidRingEnd;
    },
    polygonEnd: function() {
      centroidStream.lineStart = centroidLineStart;
      centroidStream.lineEnd = centroidLineEnd;
    }
  };
  function centroidPoint(lambda, phi) {
    lambda *= radians, phi *= radians;
    var cosPhi = cos(phi);
    centroidPointCartesian(cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi));
  }
  function centroidPointCartesian(x, y, z) {
    ++W0;
    X0 += (x - X0) / W0;
    Y0 += (y - Y0) / W0;
    Z0 += (z - Z0) / W0;
  }
  function centroidLineStart() {
    centroidStream.point = centroidLinePointFirst;
  }
  function centroidLinePointFirst(lambda, phi) {
    lambda *= radians, phi *= radians;
    var cosPhi = cos(phi);
    x0 = cosPhi * cos(lambda);
    y0 = cosPhi * sin(lambda);
    z0 = sin(phi);
    centroidStream.point = centroidLinePoint;
    centroidPointCartesian(x0, y0, z0);
  }
  function centroidLinePoint(lambda, phi) {
    lambda *= radians, phi *= radians;
    var cosPhi = cos(phi), x = cosPhi * cos(lambda), y = cosPhi * sin(lambda), z = sin(phi), w = atan2(sqrt((w = y0 * z - z0 * y) * w + (w = z0 * x - x0 * z) * w + (w = x0 * y - y0 * x) * w), x0 * x + y0 * y + z0 * z);
    W1 += w;
    X1 += w * (x0 + (x0 = x));
    Y1 += w * (y0 + (y0 = y));
    Z1 += w * (z0 + (z0 = z));
    centroidPointCartesian(x0, y0, z0);
  }
  function centroidLineEnd() {
    centroidStream.point = centroidPoint;
  }
  function centroidRingStart() {
    centroidStream.point = centroidRingPointFirst;
  }
  function centroidRingEnd() {
    centroidRingPoint(lambda002, phi002);
    centroidStream.point = centroidPoint;
  }
  function centroidRingPointFirst(lambda, phi) {
    lambda002 = lambda, phi002 = phi;
    lambda *= radians, phi *= radians;
    centroidStream.point = centroidRingPoint;
    var cosPhi = cos(phi);
    x0 = cosPhi * cos(lambda);
    y0 = cosPhi * sin(lambda);
    z0 = sin(phi);
    centroidPointCartesian(x0, y0, z0);
  }
  function centroidRingPoint(lambda, phi) {
    lambda *= radians, phi *= radians;
    var cosPhi = cos(phi), x = cosPhi * cos(lambda), y = cosPhi * sin(lambda), z = sin(phi), cx = y0 * z - z0 * y, cy = z0 * x - x0 * z, cz = x0 * y - y0 * x, m = hypot(cx, cy, cz), w = asin(m), v = m && -w / m;
    X2.add(v * cx);
    Y2.add(v * cy);
    Z2.add(v * cz);
    W1 += w;
    X1 += w * (x0 + (x0 = x));
    Y1 += w * (y0 + (y0 = y));
    Z1 += w * (z0 + (z0 = z));
    centroidPointCartesian(x0, y0, z0);
  }
  function centroid_default(object) {
    W0 = W1 = X0 = Y0 = Z0 = X1 = Y1 = Z1 = 0;
    X2 = new Adder();
    Y2 = new Adder();
    Z2 = new Adder();
    stream_default(object, centroidStream);
    var x = +X2, y = +Y2, z = +Z2, m = hypot(x, y, z);
    if (m < epsilon2) {
      x = X1, y = Y1, z = Z1;
      if (W1 < epsilon) x = X0, y = Y0, z = Z0;
      m = hypot(x, y, z);
      if (m < epsilon2) return [NaN, NaN];
    }
    return [atan2(y, x) * degrees, asin(z / m) * degrees];
  }

  // node_modules/d3-geo/src/compose.js
  function compose_default(a, b) {
    function compose(x, y) {
      return x = a(x, y), b(x[0], x[1]);
    }
    if (a.invert && b.invert) compose.invert = function(x, y) {
      return x = b.invert(x, y), x && a.invert(x[0], x[1]);
    };
    return compose;
  }

  // node_modules/d3-geo/src/rotation.js
  function rotationIdentity(lambda, phi) {
    if (abs(lambda) > pi) lambda -= Math.round(lambda / tau) * tau;
    return [lambda, phi];
  }
  rotationIdentity.invert = rotationIdentity;
  function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
    return (deltaLambda %= tau) ? deltaPhi || deltaGamma ? compose_default(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma)) : rotationLambda(deltaLambda) : deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma) : rotationIdentity;
  }
  function forwardRotationLambda(deltaLambda) {
    return function(lambda, phi) {
      lambda += deltaLambda;
      if (abs(lambda) > pi) lambda -= Math.round(lambda / tau) * tau;
      return [lambda, phi];
    };
  }
  function rotationLambda(deltaLambda) {
    var rotation = forwardRotationLambda(deltaLambda);
    rotation.invert = forwardRotationLambda(-deltaLambda);
    return rotation;
  }
  function rotationPhiGamma(deltaPhi, deltaGamma) {
    var cosDeltaPhi = cos(deltaPhi), sinDeltaPhi = sin(deltaPhi), cosDeltaGamma = cos(deltaGamma), sinDeltaGamma = sin(deltaGamma);
    function rotation(lambda, phi) {
      var cosPhi = cos(phi), x = cos(lambda) * cosPhi, y = sin(lambda) * cosPhi, z = sin(phi), k = z * cosDeltaPhi + x * sinDeltaPhi;
      return [
        atan2(y * cosDeltaGamma - k * sinDeltaGamma, x * cosDeltaPhi - z * sinDeltaPhi),
        asin(k * cosDeltaGamma + y * sinDeltaGamma)
      ];
    }
    rotation.invert = function(lambda, phi) {
      var cosPhi = cos(phi), x = cos(lambda) * cosPhi, y = sin(lambda) * cosPhi, z = sin(phi), k = z * cosDeltaGamma - y * sinDeltaGamma;
      return [
        atan2(y * cosDeltaGamma + z * sinDeltaGamma, x * cosDeltaPhi + k * sinDeltaPhi),
        asin(k * cosDeltaPhi - x * sinDeltaPhi)
      ];
    };
    return rotation;
  }
  function rotation_default(rotate) {
    rotate = rotateRadians(rotate[0] * radians, rotate[1] * radians, rotate.length > 2 ? rotate[2] * radians : 0);
    function forward(coordinates) {
      coordinates = rotate(coordinates[0] * radians, coordinates[1] * radians);
      return coordinates[0] *= degrees, coordinates[1] *= degrees, coordinates;
    }
    forward.invert = function(coordinates) {
      coordinates = rotate.invert(coordinates[0] * radians, coordinates[1] * radians);
      return coordinates[0] *= degrees, coordinates[1] *= degrees, coordinates;
    };
    return forward;
  }

  // node_modules/d3-geo/src/circle.js
  function circleStream(stream, radius, delta, direction, t0, t1) {
    if (!delta) return;
    var cosRadius = cos(radius), sinRadius = sin(radius), step = direction * delta;
    if (t0 == null) {
      t0 = radius + direction * tau;
      t1 = radius - step / 2;
    } else {
      t0 = circleRadius(cosRadius, t0);
      t1 = circleRadius(cosRadius, t1);
      if (direction > 0 ? t0 < t1 : t0 > t1) t0 += direction * tau;
    }
    for (var point, t = t0; direction > 0 ? t > t1 : t < t1; t -= step) {
      point = spherical([cosRadius, -sinRadius * cos(t), -sinRadius * sin(t)]);
      stream.point(point[0], point[1]);
    }
  }
  function circleRadius(cosRadius, point) {
    point = cartesian(point), point[0] -= cosRadius;
    cartesianNormalizeInPlace(point);
    var radius = acos(-point[1]);
    return ((-point[2] < 0 ? -radius : radius) + tau - epsilon) % tau;
  }

  // node_modules/d3-geo/src/clip/buffer.js
  function buffer_default() {
    var lines = [], line;
    return {
      point: function(x, y, m) {
        line.push([x, y, m]);
      },
      lineStart: function() {
        lines.push(line = []);
      },
      lineEnd: noop,
      rejoin: function() {
        if (lines.length > 1) lines.push(lines.pop().concat(lines.shift()));
      },
      result: function() {
        var result = lines;
        lines = [];
        line = null;
        return result;
      }
    };
  }

  // node_modules/d3-geo/src/pointEqual.js
  function pointEqual_default(a, b) {
    return abs(a[0] - b[0]) < epsilon && abs(a[1] - b[1]) < epsilon;
  }

  // node_modules/d3-geo/src/clip/rejoin.js
  function Intersection(point, points, other, entry) {
    this.x = point;
    this.z = points;
    this.o = other;
    this.e = entry;
    this.v = false;
    this.n = this.p = null;
  }
  function rejoin_default(segments, compareIntersection2, startInside, interpolate, stream) {
    var subject = [], clip = [], i, n;
    segments.forEach(function(segment) {
      if ((n2 = segment.length - 1) <= 0) return;
      var n2, p0 = segment[0], p1 = segment[n2], x;
      if (pointEqual_default(p0, p1)) {
        if (!p0[2] && !p1[2]) {
          stream.lineStart();
          for (i = 0; i < n2; ++i) stream.point((p0 = segment[i])[0], p0[1]);
          stream.lineEnd();
          return;
        }
        p1[0] += 2 * epsilon;
      }
      subject.push(x = new Intersection(p0, segment, null, true));
      clip.push(x.o = new Intersection(p0, null, x, false));
      subject.push(x = new Intersection(p1, segment, null, false));
      clip.push(x.o = new Intersection(p1, null, x, true));
    });
    if (!subject.length) return;
    clip.sort(compareIntersection2);
    link(subject);
    link(clip);
    for (i = 0, n = clip.length; i < n; ++i) {
      clip[i].e = startInside = !startInside;
    }
    var start = subject[0], points, point;
    while (1) {
      var current = start, isSubject = true;
      while (current.v) if ((current = current.n) === start) return;
      points = current.z;
      stream.lineStart();
      do {
        current.v = current.o.v = true;
        if (current.e) {
          if (isSubject) {
            for (i = 0, n = points.length; i < n; ++i) stream.point((point = points[i])[0], point[1]);
          } else {
            interpolate(current.x, current.n.x, 1, stream);
          }
          current = current.n;
        } else {
          if (isSubject) {
            points = current.p.z;
            for (i = points.length - 1; i >= 0; --i) stream.point((point = points[i])[0], point[1]);
          } else {
            interpolate(current.x, current.p.x, -1, stream);
          }
          current = current.p;
        }
        current = current.o;
        points = current.z;
        isSubject = !isSubject;
      } while (!current.v);
      stream.lineEnd();
    }
  }
  function link(array) {
    if (!(n = array.length)) return;
    var n, i = 0, a = array[0], b;
    while (++i < n) {
      a.n = b = array[i];
      b.p = a;
      a = b;
    }
    a.n = b = array[0];
    b.p = a;
  }

  // node_modules/d3-geo/src/polygonContains.js
  function longitude(point) {
    return abs(point[0]) <= pi ? point[0] : sign(point[0]) * ((abs(point[0]) + pi) % tau - pi);
  }
  function polygonContains_default(polygon, point) {
    var lambda = longitude(point), phi = point[1], sinPhi = sin(phi), normal = [sin(lambda), -cos(lambda), 0], angle = 0, winding = 0;
    var sum = new Adder();
    if (sinPhi === 1) phi = halfPi + epsilon;
    else if (sinPhi === -1) phi = -halfPi - epsilon;
    for (var i = 0, n = polygon.length; i < n; ++i) {
      if (!(m = (ring = polygon[i]).length)) continue;
      var ring, m, point0 = ring[m - 1], lambda02 = longitude(point0), phi0 = point0[1] / 2 + quarterPi, sinPhi02 = sin(phi0), cosPhi02 = cos(phi0);
      for (var j = 0; j < m; ++j, lambda02 = lambda1, sinPhi02 = sinPhi1, cosPhi02 = cosPhi1, point0 = point1) {
        var point1 = ring[j], lambda1 = longitude(point1), phi1 = point1[1] / 2 + quarterPi, sinPhi1 = sin(phi1), cosPhi1 = cos(phi1), delta = lambda1 - lambda02, sign2 = delta >= 0 ? 1 : -1, absDelta = sign2 * delta, antimeridian = absDelta > pi, k = sinPhi02 * sinPhi1;
        sum.add(atan2(k * sign2 * sin(absDelta), cosPhi02 * cosPhi1 + k * cos(absDelta)));
        angle += antimeridian ? delta + sign2 * tau : delta;
        if (antimeridian ^ lambda02 >= lambda ^ lambda1 >= lambda) {
          var arc = cartesianCross(cartesian(point0), cartesian(point1));
          cartesianNormalizeInPlace(arc);
          var intersection = cartesianCross(normal, arc);
          cartesianNormalizeInPlace(intersection);
          var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin(intersection[2]);
          if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
            winding += antimeridian ^ delta >= 0 ? 1 : -1;
          }
        }
      }
    }
    return (angle < -epsilon || angle < epsilon && sum < -epsilon2) ^ winding & 1;
  }

  // node_modules/d3-geo/src/clip/index.js
  function clip_default(pointVisible, clipLine, interpolate, start) {
    return function(sink) {
      var line = clipLine(sink), ringBuffer = buffer_default(), ringSink = clipLine(ringBuffer), polygonStarted = false, polygon, segments, ring;
      var clip = {
        point,
        lineStart,
        lineEnd,
        polygonStart: function() {
          clip.point = pointRing;
          clip.lineStart = ringStart;
          clip.lineEnd = ringEnd;
          segments = [];
          polygon = [];
        },
        polygonEnd: function() {
          clip.point = point;
          clip.lineStart = lineStart;
          clip.lineEnd = lineEnd;
          segments = merge(segments);
          var startInside = polygonContains_default(polygon, start);
          if (segments.length) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            rejoin_default(segments, compareIntersection, startInside, interpolate, sink);
          } else if (startInside) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            sink.lineStart();
            interpolate(null, null, 1, sink);
            sink.lineEnd();
          }
          if (polygonStarted) sink.polygonEnd(), polygonStarted = false;
          segments = polygon = null;
        },
        sphere: function() {
          sink.polygonStart();
          sink.lineStart();
          interpolate(null, null, 1, sink);
          sink.lineEnd();
          sink.polygonEnd();
        }
      };
      function point(lambda, phi) {
        if (pointVisible(lambda, phi)) sink.point(lambda, phi);
      }
      function pointLine(lambda, phi) {
        line.point(lambda, phi);
      }
      function lineStart() {
        clip.point = pointLine;
        line.lineStart();
      }
      function lineEnd() {
        clip.point = point;
        line.lineEnd();
      }
      function pointRing(lambda, phi) {
        ring.push([lambda, phi]);
        ringSink.point(lambda, phi);
      }
      function ringStart() {
        ringSink.lineStart();
        ring = [];
      }
      function ringEnd() {
        pointRing(ring[0][0], ring[0][1]);
        ringSink.lineEnd();
        var clean = ringSink.clean(), ringSegments = ringBuffer.result(), i, n = ringSegments.length, m, segment, point2;
        ring.pop();
        polygon.push(ring);
        ring = null;
        if (!n) return;
        if (clean & 1) {
          segment = ringSegments[0];
          if ((m = segment.length - 1) > 0) {
            if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
            sink.lineStart();
            for (i = 0; i < m; ++i) sink.point((point2 = segment[i])[0], point2[1]);
            sink.lineEnd();
          }
          return;
        }
        if (n > 1 && clean & 2) ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));
        segments.push(ringSegments.filter(validSegment));
      }
      return clip;
    };
  }
  function validSegment(segment) {
    return segment.length > 1;
  }
  function compareIntersection(a, b) {
    return ((a = a.x)[0] < 0 ? a[1] - halfPi - epsilon : halfPi - a[1]) - ((b = b.x)[0] < 0 ? b[1] - halfPi - epsilon : halfPi - b[1]);
  }

  // node_modules/d3-geo/src/clip/antimeridian.js
  var antimeridian_default = clip_default(
    function() {
      return true;
    },
    clipAntimeridianLine,
    clipAntimeridianInterpolate,
    [-pi, -halfPi]
  );
  function clipAntimeridianLine(stream) {
    var lambda02 = NaN, phi0 = NaN, sign0 = NaN, clean;
    return {
      lineStart: function() {
        stream.lineStart();
        clean = 1;
      },
      point: function(lambda1, phi1) {
        var sign1 = lambda1 > 0 ? pi : -pi, delta = abs(lambda1 - lambda02);
        if (abs(delta - pi) < epsilon) {
          stream.point(lambda02, phi0 = (phi0 + phi1) / 2 > 0 ? halfPi : -halfPi);
          stream.point(sign0, phi0);
          stream.lineEnd();
          stream.lineStart();
          stream.point(sign1, phi0);
          stream.point(lambda1, phi0);
          clean = 0;
        } else if (sign0 !== sign1 && delta >= pi) {
          if (abs(lambda02 - sign0) < epsilon) lambda02 -= sign0 * epsilon;
          if (abs(lambda1 - sign1) < epsilon) lambda1 -= sign1 * epsilon;
          phi0 = clipAntimeridianIntersect(lambda02, phi0, lambda1, phi1);
          stream.point(sign0, phi0);
          stream.lineEnd();
          stream.lineStart();
          stream.point(sign1, phi0);
          clean = 0;
        }
        stream.point(lambda02 = lambda1, phi0 = phi1);
        sign0 = sign1;
      },
      lineEnd: function() {
        stream.lineEnd();
        lambda02 = phi0 = NaN;
      },
      clean: function() {
        return 2 - clean;
      }
    };
  }
  function clipAntimeridianIntersect(lambda02, phi0, lambda1, phi1) {
    var cosPhi02, cosPhi1, sinLambda0Lambda1 = sin(lambda02 - lambda1);
    return abs(sinLambda0Lambda1) > epsilon ? atan((sin(phi0) * (cosPhi1 = cos(phi1)) * sin(lambda1) - sin(phi1) * (cosPhi02 = cos(phi0)) * sin(lambda02)) / (cosPhi02 * cosPhi1 * sinLambda0Lambda1)) : (phi0 + phi1) / 2;
  }
  function clipAntimeridianInterpolate(from, to, direction, stream) {
    var phi;
    if (from == null) {
      phi = direction * halfPi;
      stream.point(-pi, phi);
      stream.point(0, phi);
      stream.point(pi, phi);
      stream.point(pi, 0);
      stream.point(pi, -phi);
      stream.point(0, -phi);
      stream.point(-pi, -phi);
      stream.point(-pi, 0);
      stream.point(-pi, phi);
    } else if (abs(from[0] - to[0]) > epsilon) {
      var lambda = from[0] < to[0] ? pi : -pi;
      phi = direction * lambda / 2;
      stream.point(-lambda, phi);
      stream.point(0, phi);
      stream.point(lambda, phi);
    } else {
      stream.point(to[0], to[1]);
    }
  }

  // node_modules/d3-geo/src/clip/circle.js
  function circle_default(radius) {
    var cr = cos(radius), delta = 2 * radians, smallRadius = cr > 0, notHemisphere = abs(cr) > epsilon;
    function interpolate(from, to, direction, stream) {
      circleStream(stream, radius, delta, direction, from, to);
    }
    function visible(lambda, phi) {
      return cos(lambda) * cos(phi) > cr;
    }
    function clipLine(stream) {
      var point0, c0, v0, v00, clean;
      return {
        lineStart: function() {
          v00 = v0 = false;
          clean = 1;
        },
        point: function(lambda, phi) {
          var point1 = [lambda, phi], point2, v = visible(lambda, phi), c = smallRadius ? v ? 0 : code(lambda, phi) : v ? code(lambda + (lambda < 0 ? pi : -pi), phi) : 0;
          if (!point0 && (v00 = v0 = v)) stream.lineStart();
          if (v !== v0) {
            point2 = intersect(point0, point1);
            if (!point2 || pointEqual_default(point0, point2) || pointEqual_default(point1, point2))
              point1[2] = 1;
          }
          if (v !== v0) {
            clean = 0;
            if (v) {
              stream.lineStart();
              point2 = intersect(point1, point0);
              stream.point(point2[0], point2[1]);
            } else {
              point2 = intersect(point0, point1);
              stream.point(point2[0], point2[1], 2);
              stream.lineEnd();
            }
            point0 = point2;
          } else if (notHemisphere && point0 && smallRadius ^ v) {
            var t;
            if (!(c & c0) && (t = intersect(point1, point0, true))) {
              clean = 0;
              if (smallRadius) {
                stream.lineStart();
                stream.point(t[0][0], t[0][1]);
                stream.point(t[1][0], t[1][1]);
                stream.lineEnd();
              } else {
                stream.point(t[1][0], t[1][1]);
                stream.lineEnd();
                stream.lineStart();
                stream.point(t[0][0], t[0][1], 3);
              }
            }
          }
          if (v && (!point0 || !pointEqual_default(point0, point1))) {
            stream.point(point1[0], point1[1]);
          }
          point0 = point1, v0 = v, c0 = c;
        },
        lineEnd: function() {
          if (v0) stream.lineEnd();
          point0 = null;
        },
        // Rejoin first and last segments if there were intersections and the first
        // and last points were visible.
        clean: function() {
          return clean | (v00 && v0) << 1;
        }
      };
    }
    function intersect(a, b, two) {
      var pa = cartesian(a), pb = cartesian(b);
      var n1 = [1, 0, 0], n2 = cartesianCross(pa, pb), n2n2 = cartesianDot(n2, n2), n1n2 = n2[0], determinant = n2n2 - n1n2 * n1n2;
      if (!determinant) return !two && a;
      var c1 = cr * n2n2 / determinant, c2 = -cr * n1n2 / determinant, n1xn2 = cartesianCross(n1, n2), A = cartesianScale(n1, c1), B = cartesianScale(n2, c2);
      cartesianAddInPlace(A, B);
      var u = n1xn2, w = cartesianDot(A, u), uu = cartesianDot(u, u), t2 = w * w - uu * (cartesianDot(A, A) - 1);
      if (t2 < 0) return;
      var t = sqrt(t2), q = cartesianScale(u, (-w - t) / uu);
      cartesianAddInPlace(q, A);
      q = spherical(q);
      if (!two) return q;
      var lambda02 = a[0], lambda1 = b[0], phi0 = a[1], phi1 = b[1], z;
      if (lambda1 < lambda02) z = lambda02, lambda02 = lambda1, lambda1 = z;
      var delta2 = lambda1 - lambda02, polar = abs(delta2 - pi) < epsilon, meridian = polar || delta2 < epsilon;
      if (!polar && phi1 < phi0) z = phi0, phi0 = phi1, phi1 = z;
      if (meridian ? polar ? phi0 + phi1 > 0 ^ q[1] < (abs(q[0] - lambda02) < epsilon ? phi0 : phi1) : phi0 <= q[1] && q[1] <= phi1 : delta2 > pi ^ (lambda02 <= q[0] && q[0] <= lambda1)) {
        var q1 = cartesianScale(u, (-w + t) / uu);
        cartesianAddInPlace(q1, A);
        return [q, spherical(q1)];
      }
    }
    function code(lambda, phi) {
      var r = smallRadius ? radius : pi - radius, code2 = 0;
      if (lambda < -r) code2 |= 1;
      else if (lambda > r) code2 |= 2;
      if (phi < -r) code2 |= 4;
      else if (phi > r) code2 |= 8;
      return code2;
    }
    return clip_default(visible, clipLine, interpolate, smallRadius ? [0, -radius] : [-pi, radius - pi]);
  }

  // node_modules/d3-geo/src/clip/line.js
  function line_default(a, b, x06, y06, x12, y12) {
    var ax = a[0], ay = a[1], bx = b[0], by = b[1], t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, r;
    r = x06 - ax;
    if (!dx && r > 0) return;
    r /= dx;
    if (dx < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dx > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }
    r = x12 - ax;
    if (!dx && r < 0) return;
    r /= dx;
    if (dx < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dx > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }
    r = y06 - ay;
    if (!dy && r > 0) return;
    r /= dy;
    if (dy < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dy > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }
    r = y12 - ay;
    if (!dy && r < 0) return;
    r /= dy;
    if (dy < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dy > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }
    if (t0 > 0) a[0] = ax + t0 * dx, a[1] = ay + t0 * dy;
    if (t1 < 1) b[0] = ax + t1 * dx, b[1] = ay + t1 * dy;
    return true;
  }

  // node_modules/d3-geo/src/clip/rectangle.js
  var clipMax = 1e9;
  var clipMin = -clipMax;
  function clipRectangle(x06, y06, x12, y12) {
    function visible(x, y) {
      return x06 <= x && x <= x12 && y06 <= y && y <= y12;
    }
    function interpolate(from, to, direction, stream) {
      var a = 0, a1 = 0;
      if (from == null || (a = corner(from, direction)) !== (a1 = corner(to, direction)) || comparePoint(from, to) < 0 ^ direction > 0) {
        do
          stream.point(a === 0 || a === 3 ? x06 : x12, a > 1 ? y12 : y06);
        while ((a = (a + direction + 4) % 4) !== a1);
      } else {
        stream.point(to[0], to[1]);
      }
    }
    function corner(p, direction) {
      return abs(p[0] - x06) < epsilon ? direction > 0 ? 0 : 3 : abs(p[0] - x12) < epsilon ? direction > 0 ? 2 : 1 : abs(p[1] - y06) < epsilon ? direction > 0 ? 1 : 0 : direction > 0 ? 3 : 2;
    }
    function compareIntersection2(a, b) {
      return comparePoint(a.x, b.x);
    }
    function comparePoint(a, b) {
      var ca = corner(a, 1), cb = corner(b, 1);
      return ca !== cb ? ca - cb : ca === 0 ? b[1] - a[1] : ca === 1 ? a[0] - b[0] : ca === 2 ? a[1] - b[1] : b[0] - a[0];
    }
    return function(stream) {
      var activeStream = stream, bufferStream = buffer_default(), segments, polygon, ring, x__, y__, v__, x_, y_, v_, first, clean;
      var clipStream = {
        point,
        lineStart,
        lineEnd,
        polygonStart,
        polygonEnd
      };
      function point(x, y) {
        if (visible(x, y)) activeStream.point(x, y);
      }
      function polygonInside() {
        var winding = 0;
        for (var i = 0, n = polygon.length; i < n; ++i) {
          for (var ring2 = polygon[i], j = 1, m = ring2.length, point2 = ring2[0], a0, a1, b0 = point2[0], b1 = point2[1]; j < m; ++j) {
            a0 = b0, a1 = b1, point2 = ring2[j], b0 = point2[0], b1 = point2[1];
            if (a1 <= y12) {
              if (b1 > y12 && (b0 - a0) * (y12 - a1) > (b1 - a1) * (x06 - a0)) ++winding;
            } else {
              if (b1 <= y12 && (b0 - a0) * (y12 - a1) < (b1 - a1) * (x06 - a0)) --winding;
            }
          }
        }
        return winding;
      }
      function polygonStart() {
        activeStream = bufferStream, segments = [], polygon = [], clean = true;
      }
      function polygonEnd() {
        var startInside = polygonInside(), cleanInside = clean && startInside, visible2 = (segments = merge(segments)).length;
        if (cleanInside || visible2) {
          stream.polygonStart();
          if (cleanInside) {
            stream.lineStart();
            interpolate(null, null, 1, stream);
            stream.lineEnd();
          }
          if (visible2) {
            rejoin_default(segments, compareIntersection2, startInside, interpolate, stream);
          }
          stream.polygonEnd();
        }
        activeStream = stream, segments = polygon = ring = null;
      }
      function lineStart() {
        clipStream.point = linePoint;
        if (polygon) polygon.push(ring = []);
        first = true;
        v_ = false;
        x_ = y_ = NaN;
      }
      function lineEnd() {
        if (segments) {
          linePoint(x__, y__);
          if (v__ && v_) bufferStream.rejoin();
          segments.push(bufferStream.result());
        }
        clipStream.point = point;
        if (v_) activeStream.lineEnd();
      }
      function linePoint(x, y) {
        var v = visible(x, y);
        if (polygon) ring.push([x, y]);
        if (first) {
          x__ = x, y__ = y, v__ = v;
          first = false;
          if (v) {
            activeStream.lineStart();
            activeStream.point(x, y);
          }
        } else {
          if (v && v_) activeStream.point(x, y);
          else {
            var a = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))], b = [x = Math.max(clipMin, Math.min(clipMax, x)), y = Math.max(clipMin, Math.min(clipMax, y))];
            if (line_default(a, b, x06, y06, x12, y12)) {
              if (!v_) {
                activeStream.lineStart();
                activeStream.point(a[0], a[1]);
              }
              activeStream.point(b[0], b[1]);
              if (!v) activeStream.lineEnd();
              clean = false;
            } else if (v) {
              activeStream.lineStart();
              activeStream.point(x, y);
              clean = false;
            }
          }
        }
        x_ = x, y_ = y, v_ = v;
      }
      return clipStream;
    };
  }

  // node_modules/d3-geo/src/graticule.js
  function graticuleX(y06, y12, dy) {
    var y = range(y06, y12 - epsilon, dy).concat(y12);
    return function(x) {
      return y.map(function(y2) {
        return [x, y2];
      });
    };
  }
  function graticuleY(x06, x12, dx) {
    var x = range(x06, x12 - epsilon, dx).concat(x12);
    return function(y) {
      return x.map(function(x2) {
        return [x2, y];
      });
    };
  }
  function graticule() {
    var x12, x06, X13, X03, y12, y06, Y13, Y03, dx = 10, dy = dx, DX = 90, DY = 360, x, y, X, Y, precision = 2.5;
    function graticule2() {
      return { type: "MultiLineString", coordinates: lines() };
    }
    function lines() {
      return range(ceil(X03 / DX) * DX, X13, DX).map(X).concat(range(ceil(Y03 / DY) * DY, Y13, DY).map(Y)).concat(range(ceil(x06 / dx) * dx, x12, dx).filter(function(x2) {
        return abs(x2 % DX) > epsilon;
      }).map(x)).concat(range(ceil(y06 / dy) * dy, y12, dy).filter(function(y2) {
        return abs(y2 % DY) > epsilon;
      }).map(y));
    }
    graticule2.lines = function() {
      return lines().map(function(coordinates) {
        return { type: "LineString", coordinates };
      });
    };
    graticule2.outline = function() {
      return {
        type: "Polygon",
        coordinates: [
          X(X03).concat(
            Y(Y13).slice(1),
            X(X13).reverse().slice(1),
            Y(Y03).reverse().slice(1)
          )
        ]
      };
    };
    graticule2.extent = function(_) {
      if (!arguments.length) return graticule2.extentMinor();
      return graticule2.extentMajor(_).extentMinor(_);
    };
    graticule2.extentMajor = function(_) {
      if (!arguments.length) return [[X03, Y03], [X13, Y13]];
      X03 = +_[0][0], X13 = +_[1][0];
      Y03 = +_[0][1], Y13 = +_[1][1];
      if (X03 > X13) _ = X03, X03 = X13, X13 = _;
      if (Y03 > Y13) _ = Y03, Y03 = Y13, Y13 = _;
      return graticule2.precision(precision);
    };
    graticule2.extentMinor = function(_) {
      if (!arguments.length) return [[x06, y06], [x12, y12]];
      x06 = +_[0][0], x12 = +_[1][0];
      y06 = +_[0][1], y12 = +_[1][1];
      if (x06 > x12) _ = x06, x06 = x12, x12 = _;
      if (y06 > y12) _ = y06, y06 = y12, y12 = _;
      return graticule2.precision(precision);
    };
    graticule2.step = function(_) {
      if (!arguments.length) return graticule2.stepMinor();
      return graticule2.stepMajor(_).stepMinor(_);
    };
    graticule2.stepMajor = function(_) {
      if (!arguments.length) return [DX, DY];
      DX = +_[0], DY = +_[1];
      return graticule2;
    };
    graticule2.stepMinor = function(_) {
      if (!arguments.length) return [dx, dy];
      dx = +_[0], dy = +_[1];
      return graticule2;
    };
    graticule2.precision = function(_) {
      if (!arguments.length) return precision;
      precision = +_;
      x = graticuleX(y06, y12, 90);
      y = graticuleY(x06, x12, precision);
      X = graticuleX(Y03, Y13, 90);
      Y = graticuleY(X03, X13, precision);
      return graticule2;
    };
    return graticule2.extentMajor([[-180, -90 + epsilon], [180, 90 - epsilon]]).extentMinor([[-180, -80 - epsilon], [180, 80 + epsilon]]);
  }
  function graticule10() {
    return graticule()();
  }

  // node_modules/d3-geo/src/identity.js
  var identity_default = (x) => x;

  // node_modules/d3-geo/src/path/area.js
  var areaSum2 = new Adder();
  var areaRingSum2 = new Adder();
  var x00;
  var y00;
  var x02;
  var y02;
  var areaStream2 = {
    point: noop,
    lineStart: noop,
    lineEnd: noop,
    polygonStart: function() {
      areaStream2.lineStart = areaRingStart2;
      areaStream2.lineEnd = areaRingEnd2;
    },
    polygonEnd: function() {
      areaStream2.lineStart = areaStream2.lineEnd = areaStream2.point = noop;
      areaSum2.add(abs(areaRingSum2));
      areaRingSum2 = new Adder();
    },
    result: function() {
      var area = areaSum2 / 2;
      areaSum2 = new Adder();
      return area;
    }
  };
  function areaRingStart2() {
    areaStream2.point = areaPointFirst2;
  }
  function areaPointFirst2(x, y) {
    areaStream2.point = areaPoint2;
    x00 = x02 = x, y00 = y02 = y;
  }
  function areaPoint2(x, y) {
    areaRingSum2.add(y02 * x - x02 * y);
    x02 = x, y02 = y;
  }
  function areaRingEnd2() {
    areaPoint2(x00, y00);
  }
  var area_default2 = areaStream2;

  // node_modules/d3-geo/src/path/bounds.js
  var x03 = Infinity;
  var y03 = x03;
  var x1 = -x03;
  var y1 = x1;
  var boundsStream = {
    point: boundsPoint,
    lineStart: noop,
    lineEnd: noop,
    polygonStart: noop,
    polygonEnd: noop,
    result: function() {
      var bounds = [[x03, y03], [x1, y1]];
      x1 = y1 = -(y03 = x03 = Infinity);
      return bounds;
    }
  };
  function boundsPoint(x, y) {
    if (x < x03) x03 = x;
    if (x > x1) x1 = x;
    if (y < y03) y03 = y;
    if (y > y1) y1 = y;
  }
  var bounds_default = boundsStream;

  // node_modules/d3-geo/src/path/centroid.js
  var X02 = 0;
  var Y02 = 0;
  var Z02 = 0;
  var X12 = 0;
  var Y12 = 0;
  var Z12 = 0;
  var X22 = 0;
  var Y22 = 0;
  var Z22 = 0;
  var x002;
  var y002;
  var x04;
  var y04;
  var centroidStream2 = {
    point: centroidPoint2,
    lineStart: centroidLineStart2,
    lineEnd: centroidLineEnd2,
    polygonStart: function() {
      centroidStream2.lineStart = centroidRingStart2;
      centroidStream2.lineEnd = centroidRingEnd2;
    },
    polygonEnd: function() {
      centroidStream2.point = centroidPoint2;
      centroidStream2.lineStart = centroidLineStart2;
      centroidStream2.lineEnd = centroidLineEnd2;
    },
    result: function() {
      var centroid = Z22 ? [X22 / Z22, Y22 / Z22] : Z12 ? [X12 / Z12, Y12 / Z12] : Z02 ? [X02 / Z02, Y02 / Z02] : [NaN, NaN];
      X02 = Y02 = Z02 = X12 = Y12 = Z12 = X22 = Y22 = Z22 = 0;
      return centroid;
    }
  };
  function centroidPoint2(x, y) {
    X02 += x;
    Y02 += y;
    ++Z02;
  }
  function centroidLineStart2() {
    centroidStream2.point = centroidPointFirstLine;
  }
  function centroidPointFirstLine(x, y) {
    centroidStream2.point = centroidPointLine;
    centroidPoint2(x04 = x, y04 = y);
  }
  function centroidPointLine(x, y) {
    var dx = x - x04, dy = y - y04, z = sqrt(dx * dx + dy * dy);
    X12 += z * (x04 + x) / 2;
    Y12 += z * (y04 + y) / 2;
    Z12 += z;
    centroidPoint2(x04 = x, y04 = y);
  }
  function centroidLineEnd2() {
    centroidStream2.point = centroidPoint2;
  }
  function centroidRingStart2() {
    centroidStream2.point = centroidPointFirstRing;
  }
  function centroidRingEnd2() {
    centroidPointRing(x002, y002);
  }
  function centroidPointFirstRing(x, y) {
    centroidStream2.point = centroidPointRing;
    centroidPoint2(x002 = x04 = x, y002 = y04 = y);
  }
  function centroidPointRing(x, y) {
    var dx = x - x04, dy = y - y04, z = sqrt(dx * dx + dy * dy);
    X12 += z * (x04 + x) / 2;
    Y12 += z * (y04 + y) / 2;
    Z12 += z;
    z = y04 * x - x04 * y;
    X22 += z * (x04 + x);
    Y22 += z * (y04 + y);
    Z22 += z * 3;
    centroidPoint2(x04 = x, y04 = y);
  }
  var centroid_default2 = centroidStream2;

  // node_modules/d3-geo/src/path/context.js
  function PathContext(context) {
    this._context = context;
  }
  PathContext.prototype = {
    _radius: 4.5,
    pointRadius: function(_) {
      return this._radius = _, this;
    },
    polygonStart: function() {
      this._line = 0;
    },
    polygonEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line === 0) this._context.closePath();
      this._point = NaN;
    },
    point: function(x, y) {
      switch (this._point) {
        case 0: {
          this._context.moveTo(x, y);
          this._point = 1;
          break;
        }
        case 1: {
          this._context.lineTo(x, y);
          break;
        }
        default: {
          this._context.moveTo(x + this._radius, y);
          this._context.arc(x, y, this._radius, 0, tau);
          break;
        }
      }
    },
    result: noop
  };

  // node_modules/d3-geo/src/path/measure.js
  var lengthSum = new Adder();
  var lengthRing;
  var x003;
  var y003;
  var x05;
  var y05;
  var lengthStream = {
    point: noop,
    lineStart: function() {
      lengthStream.point = lengthPointFirst;
    },
    lineEnd: function() {
      if (lengthRing) lengthPoint(x003, y003);
      lengthStream.point = noop;
    },
    polygonStart: function() {
      lengthRing = true;
    },
    polygonEnd: function() {
      lengthRing = null;
    },
    result: function() {
      var length = +lengthSum;
      lengthSum = new Adder();
      return length;
    }
  };
  function lengthPointFirst(x, y) {
    lengthStream.point = lengthPoint;
    x003 = x05 = x, y003 = y05 = y;
  }
  function lengthPoint(x, y) {
    x05 -= x, y05 -= y;
    lengthSum.add(sqrt(x05 * x05 + y05 * y05));
    x05 = x, y05 = y;
  }
  var measure_default = lengthStream;

  // node_modules/d3-geo/src/path/string.js
  var cacheDigits;
  var cacheAppend;
  var cacheRadius;
  var cacheCircle;
  var PathString = class {
    constructor(digits) {
      this._append = digits == null ? append : appendRound(digits);
      this._radius = 4.5;
      this._ = "";
    }
    pointRadius(_) {
      this._radius = +_;
      return this;
    }
    polygonStart() {
      this._line = 0;
    }
    polygonEnd() {
      this._line = NaN;
    }
    lineStart() {
      this._point = 0;
    }
    lineEnd() {
      if (this._line === 0) this._ += "Z";
      this._point = NaN;
    }
    point(x, y) {
      switch (this._point) {
        case 0: {
          this._append`M${x},${y}`;
          this._point = 1;
          break;
        }
        case 1: {
          this._append`L${x},${y}`;
          break;
        }
        default: {
          this._append`M${x},${y}`;
          if (this._radius !== cacheRadius || this._append !== cacheAppend) {
            const r = this._radius;
            const s = this._;
            this._ = "";
            this._append`m0,${r}a${r},${r} 0 1,1 0,${-2 * r}a${r},${r} 0 1,1 0,${2 * r}z`;
            cacheRadius = r;
            cacheAppend = this._append;
            cacheCircle = this._;
            this._ = s;
          }
          this._ += cacheCircle;
          break;
        }
      }
    }
    result() {
      const result = this._;
      this._ = "";
      return result.length ? result : null;
    }
  };
  function append(strings) {
    let i = 1;
    this._ += strings[0];
    for (const j = strings.length; i < j; ++i) {
      this._ += arguments[i] + strings[i];
    }
  }
  function appendRound(digits) {
    const d = Math.floor(digits);
    if (!(d >= 0)) throw new RangeError(`invalid digits: ${digits}`);
    if (d > 15) return append;
    if (d !== cacheDigits) {
      const k = 10 ** d;
      cacheDigits = d;
      cacheAppend = function append2(strings) {
        let i = 1;
        this._ += strings[0];
        for (const j = strings.length; i < j; ++i) {
          this._ += Math.round(arguments[i] * k) / k + strings[i];
        }
      };
    }
    return cacheAppend;
  }

  // node_modules/d3-geo/src/path/index.js
  function path_default(projection2, context) {
    let digits = 3, pointRadius = 4.5, projectionStream, contextStream;
    function path(object) {
      if (object) {
        if (typeof pointRadius === "function") contextStream.pointRadius(+pointRadius.apply(this, arguments));
        stream_default(object, projectionStream(contextStream));
      }
      return contextStream.result();
    }
    path.area = function(object) {
      stream_default(object, projectionStream(area_default2));
      return area_default2.result();
    };
    path.measure = function(object) {
      stream_default(object, projectionStream(measure_default));
      return measure_default.result();
    };
    path.bounds = function(object) {
      stream_default(object, projectionStream(bounds_default));
      return bounds_default.result();
    };
    path.centroid = function(object) {
      stream_default(object, projectionStream(centroid_default2));
      return centroid_default2.result();
    };
    path.projection = function(_) {
      if (!arguments.length) return projection2;
      projectionStream = _ == null ? (projection2 = null, identity_default) : (projection2 = _).stream;
      return path;
    };
    path.context = function(_) {
      if (!arguments.length) return context;
      contextStream = _ == null ? (context = null, new PathString(digits)) : new PathContext(context = _);
      if (typeof pointRadius !== "function") contextStream.pointRadius(pointRadius);
      return path;
    };
    path.pointRadius = function(_) {
      if (!arguments.length) return pointRadius;
      pointRadius = typeof _ === "function" ? _ : (contextStream.pointRadius(+_), +_);
      return path;
    };
    path.digits = function(_) {
      if (!arguments.length) return digits;
      if (_ == null) digits = null;
      else {
        const d = Math.floor(_);
        if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
        digits = d;
      }
      if (context === null) contextStream = new PathString(digits);
      return path;
    };
    return path.projection(projection2).digits(digits).context(context);
  }

  // node_modules/d3-geo/src/transform.js
  function transformer(methods) {
    return function(stream) {
      var s = new TransformStream();
      for (var key in methods) s[key] = methods[key];
      s.stream = stream;
      return s;
    };
  }
  function TransformStream() {
  }
  TransformStream.prototype = {
    constructor: TransformStream,
    point: function(x, y) {
      this.stream.point(x, y);
    },
    sphere: function() {
      this.stream.sphere();
    },
    lineStart: function() {
      this.stream.lineStart();
    },
    lineEnd: function() {
      this.stream.lineEnd();
    },
    polygonStart: function() {
      this.stream.polygonStart();
    },
    polygonEnd: function() {
      this.stream.polygonEnd();
    }
  };

  // node_modules/d3-geo/src/projection/fit.js
  function fit(projection2, fitBounds, object) {
    var clip = projection2.clipExtent && projection2.clipExtent();
    projection2.scale(150).translate([0, 0]);
    if (clip != null) projection2.clipExtent(null);
    stream_default(object, projection2.stream(bounds_default));
    fitBounds(bounds_default.result());
    if (clip != null) projection2.clipExtent(clip);
    return projection2;
  }
  function fitExtent(projection2, extent, object) {
    return fit(projection2, function(b) {
      var w = extent[1][0] - extent[0][0], h = extent[1][1] - extent[0][1], k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])), x = +extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2, y = +extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;
      projection2.scale(150 * k).translate([x, y]);
    }, object);
  }
  function fitSize(projection2, size, object) {
    return fitExtent(projection2, [[0, 0], size], object);
  }
  function fitWidth(projection2, width, object) {
    return fit(projection2, function(b) {
      var w = +width, k = w / (b[1][0] - b[0][0]), x = (w - k * (b[1][0] + b[0][0])) / 2, y = -k * b[0][1];
      projection2.scale(150 * k).translate([x, y]);
    }, object);
  }
  function fitHeight(projection2, height, object) {
    return fit(projection2, function(b) {
      var h = +height, k = h / (b[1][1] - b[0][1]), x = -k * b[0][0], y = (h - k * (b[1][1] + b[0][1])) / 2;
      projection2.scale(150 * k).translate([x, y]);
    }, object);
  }

  // node_modules/d3-geo/src/projection/resample.js
  var maxDepth = 16;
  var cosMinDistance = cos(30 * radians);
  function resample_default(project, delta2) {
    return +delta2 ? resample(project, delta2) : resampleNone(project);
  }
  function resampleNone(project) {
    return transformer({
      point: function(x, y) {
        x = project(x, y);
        this.stream.point(x[0], x[1]);
      }
    });
  }
  function resample(project, delta2) {
    function resampleLineTo(x06, y06, lambda02, a0, b0, c0, x12, y12, lambda1, a1, b1, c1, depth, stream) {
      var dx = x12 - x06, dy = y12 - y06, d2 = dx * dx + dy * dy;
      if (d2 > 4 * delta2 && depth--) {
        var a = a0 + a1, b = b0 + b1, c = c0 + c1, m = sqrt(a * a + b * b + c * c), phi2 = asin(c /= m), lambda2 = abs(abs(c) - 1) < epsilon || abs(lambda02 - lambda1) < epsilon ? (lambda02 + lambda1) / 2 : atan2(b, a), p = project(lambda2, phi2), x2 = p[0], y2 = p[1], dx2 = x2 - x06, dy2 = y2 - y06, dz = dy * dx2 - dx * dy2;
        if (dz * dz / d2 > delta2 || abs((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) {
          resampleLineTo(x06, y06, lambda02, a0, b0, c0, x2, y2, lambda2, a /= m, b /= m, c, depth, stream);
          stream.point(x2, y2);
          resampleLineTo(x2, y2, lambda2, a, b, c, x12, y12, lambda1, a1, b1, c1, depth, stream);
        }
      }
    }
    return function(stream) {
      var lambda003, x004, y004, a00, b00, c00, lambda02, x06, y06, a0, b0, c0;
      var resampleStream = {
        point,
        lineStart,
        lineEnd,
        polygonStart: function() {
          stream.polygonStart();
          resampleStream.lineStart = ringStart;
        },
        polygonEnd: function() {
          stream.polygonEnd();
          resampleStream.lineStart = lineStart;
        }
      };
      function point(x, y) {
        x = project(x, y);
        stream.point(x[0], x[1]);
      }
      function lineStart() {
        x06 = NaN;
        resampleStream.point = linePoint;
        stream.lineStart();
      }
      function linePoint(lambda, phi) {
        var c = cartesian([lambda, phi]), p = project(lambda, phi);
        resampleLineTo(x06, y06, lambda02, a0, b0, c0, x06 = p[0], y06 = p[1], lambda02 = lambda, a0 = c[0], b0 = c[1], c0 = c[2], maxDepth, stream);
        stream.point(x06, y06);
      }
      function lineEnd() {
        resampleStream.point = point;
        stream.lineEnd();
      }
      function ringStart() {
        lineStart();
        resampleStream.point = ringPoint;
        resampleStream.lineEnd = ringEnd;
      }
      function ringPoint(lambda, phi) {
        linePoint(lambda003 = lambda, phi), x004 = x06, y004 = y06, a00 = a0, b00 = b0, c00 = c0;
        resampleStream.point = linePoint;
      }
      function ringEnd() {
        resampleLineTo(x06, y06, lambda02, a0, b0, c0, x004, y004, lambda003, a00, b00, c00, maxDepth, stream);
        resampleStream.lineEnd = lineEnd;
        lineEnd();
      }
      return resampleStream;
    };
  }

  // node_modules/d3-geo/src/projection/index.js
  var transformRadians = transformer({
    point: function(x, y) {
      this.stream.point(x * radians, y * radians);
    }
  });
  function transformRotate(rotate) {
    return transformer({
      point: function(x, y) {
        var r = rotate(x, y);
        return this.stream.point(r[0], r[1]);
      }
    });
  }
  function scaleTranslate(k, dx, dy, sx, sy) {
    function transform(x, y) {
      x *= sx;
      y *= sy;
      return [dx + k * x, dy - k * y];
    }
    transform.invert = function(x, y) {
      return [(x - dx) / k * sx, (dy - y) / k * sy];
    };
    return transform;
  }
  function scaleTranslateRotate(k, dx, dy, sx, sy, alpha) {
    if (!alpha) return scaleTranslate(k, dx, dy, sx, sy);
    var cosAlpha = cos(alpha), sinAlpha = sin(alpha), a = cosAlpha * k, b = sinAlpha * k, ai = cosAlpha / k, bi = sinAlpha / k, ci = (sinAlpha * dy - cosAlpha * dx) / k, fi = (sinAlpha * dx + cosAlpha * dy) / k;
    function transform(x, y) {
      x *= sx;
      y *= sy;
      return [a * x - b * y + dx, dy - b * x - a * y];
    }
    transform.invert = function(x, y) {
      return [sx * (ai * x - bi * y + ci), sy * (fi - bi * x - ai * y)];
    };
    return transform;
  }
  function projection(project) {
    return projectionMutator(function() {
      return project;
    })();
  }
  function projectionMutator(projectAt) {
    var project, k = 150, x = 480, y = 250, lambda = 0, phi = 0, deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, alpha = 0, sx = 1, sy = 1, theta = null, preclip = antimeridian_default, x06 = null, y06, x12, y12, postclip = identity_default, delta2 = 0.5, projectResample, projectTransform, projectRotateTransform, cache, cacheStream;
    function projection2(point) {
      return projectRotateTransform(point[0] * radians, point[1] * radians);
    }
    function invert(point) {
      point = projectRotateTransform.invert(point[0], point[1]);
      return point && [point[0] * degrees, point[1] * degrees];
    }
    projection2.stream = function(stream) {
      return cache && cacheStream === stream ? cache : cache = transformRadians(transformRotate(rotate)(preclip(projectResample(postclip(cacheStream = stream)))));
    };
    projection2.preclip = function(_) {
      return arguments.length ? (preclip = _, theta = void 0, reset()) : preclip;
    };
    projection2.postclip = function(_) {
      return arguments.length ? (postclip = _, x06 = y06 = x12 = y12 = null, reset()) : postclip;
    };
    projection2.clipAngle = function(_) {
      return arguments.length ? (preclip = +_ ? circle_default(theta = _ * radians) : (theta = null, antimeridian_default), reset()) : theta * degrees;
    };
    projection2.clipExtent = function(_) {
      return arguments.length ? (postclip = _ == null ? (x06 = y06 = x12 = y12 = null, identity_default) : clipRectangle(x06 = +_[0][0], y06 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1]), reset()) : x06 == null ? null : [[x06, y06], [x12, y12]];
    };
    projection2.scale = function(_) {
      return arguments.length ? (k = +_, recenter()) : k;
    };
    projection2.translate = function(_) {
      return arguments.length ? (x = +_[0], y = +_[1], recenter()) : [x, y];
    };
    projection2.center = function(_) {
      return arguments.length ? (lambda = _[0] % 360 * radians, phi = _[1] % 360 * radians, recenter()) : [lambda * degrees, phi * degrees];
    };
    projection2.rotate = function(_) {
      return arguments.length ? (deltaLambda = _[0] % 360 * radians, deltaPhi = _[1] % 360 * radians, deltaGamma = _.length > 2 ? _[2] % 360 * radians : 0, recenter()) : [deltaLambda * degrees, deltaPhi * degrees, deltaGamma * degrees];
    };
    projection2.angle = function(_) {
      return arguments.length ? (alpha = _ % 360 * radians, recenter()) : alpha * degrees;
    };
    projection2.reflectX = function(_) {
      return arguments.length ? (sx = _ ? -1 : 1, recenter()) : sx < 0;
    };
    projection2.reflectY = function(_) {
      return arguments.length ? (sy = _ ? -1 : 1, recenter()) : sy < 0;
    };
    projection2.precision = function(_) {
      return arguments.length ? (projectResample = resample_default(projectTransform, delta2 = _ * _), reset()) : sqrt(delta2);
    };
    projection2.fitExtent = function(extent, object) {
      return fitExtent(projection2, extent, object);
    };
    projection2.fitSize = function(size, object) {
      return fitSize(projection2, size, object);
    };
    projection2.fitWidth = function(width, object) {
      return fitWidth(projection2, width, object);
    };
    projection2.fitHeight = function(height, object) {
      return fitHeight(projection2, height, object);
    };
    function recenter() {
      var center = scaleTranslateRotate(k, 0, 0, sx, sy, alpha).apply(null, project(lambda, phi)), transform = scaleTranslateRotate(k, x - center[0], y - center[1], sx, sy, alpha);
      rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma);
      projectTransform = compose_default(project, transform);
      projectRotateTransform = compose_default(rotate, projectTransform);
      projectResample = resample_default(projectTransform, delta2);
      return reset();
    }
    function reset() {
      cache = cacheStream = null;
      return projection2;
    }
    return function() {
      project = projectAt.apply(this, arguments);
      projection2.invert = project.invert && invert;
      return recenter();
    };
  }

  // node_modules/d3-geo/src/projection/azimuthal.js
  function azimuthalInvert(angle) {
    return function(x, y) {
      var z = sqrt(x * x + y * y), c = angle(z), sc = sin(c), cc = cos(c);
      return [
        atan2(x * sc, z * cc),
        asin(z && y * sc / z)
      ];
    };
  }

  // node_modules/d3-geo/src/projection/mercator.js
  function mercatorRaw(lambda, phi) {
    return [lambda, log(tan((halfPi + phi) / 2))];
  }
  mercatorRaw.invert = function(x, y) {
    return [x, 2 * atan(exp(y)) - halfPi];
  };
  function mercator_default() {
    return mercatorProjection(mercatorRaw).scale(961 / tau);
  }
  function mercatorProjection(project) {
    var m = projection(project), center = m.center, scale = m.scale, translate = m.translate, clipExtent = m.clipExtent, x06 = null, y06, x12, y12;
    m.scale = function(_) {
      return arguments.length ? (scale(_), reclip()) : scale();
    };
    m.translate = function(_) {
      return arguments.length ? (translate(_), reclip()) : translate();
    };
    m.center = function(_) {
      return arguments.length ? (center(_), reclip()) : center();
    };
    m.clipExtent = function(_) {
      return arguments.length ? (_ == null ? x06 = y06 = x12 = y12 = null : (x06 = +_[0][0], y06 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1]), reclip()) : x06 == null ? null : [[x06, y06], [x12, y12]];
    };
    function reclip() {
      var k = pi * scale(), t = m(rotation_default(m.rotate()).invert([0, 0]));
      return clipExtent(x06 == null ? [[t[0] - k, t[1] - k], [t[0] + k, t[1] + k]] : project === mercatorRaw ? [[Math.max(t[0] - k, x06), y06], [Math.min(t[0] + k, x12), y12]] : [[x06, Math.max(t[1] - k, y06)], [x12, Math.min(t[1] + k, y12)]]);
    }
    return reclip();
  }

  // node_modules/d3-geo/src/projection/equalEarth.js
  var A1 = 1.340264;
  var A2 = -0.081106;
  var A3 = 893e-6;
  var A4 = 3796e-6;
  var M = sqrt(3) / 2;
  var iterations = 12;
  function equalEarthRaw(lambda, phi) {
    var l = asin(M * sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
    return [
      lambda * cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
      l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))
    ];
  }
  equalEarthRaw.invert = function(x, y) {
    var l = y, l2 = l * l, l6 = l2 * l2 * l2;
    for (var i = 0, delta, fy, fpy; i < iterations; ++i) {
      fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y;
      fpy = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2);
      l -= delta = fy / fpy, l2 = l * l, l6 = l2 * l2 * l2;
      if (abs(delta) < epsilon2) break;
    }
    return [
      M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)) / cos(l),
      asin(sin(l) / M)
    ];
  };
  function equalEarth_default() {
    return projection(equalEarthRaw).scale(177.158);
  }

  // node_modules/d3-geo/src/projection/orthographic.js
  function orthographicRaw(x, y) {
    return [cos(y) * sin(x), sin(y)];
  }
  orthographicRaw.invert = azimuthalInvert(asin);
  function orthographic_default() {
    return projection(orthographicRaw).scale(249.5).clipAngle(90 + epsilon);
  }
  return __toCommonJS(geo_entry_exports);
})();
