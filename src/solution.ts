import { EdgesGeometry, StaticDrawUsage } from 'three';
import { Side, Axis, Color, Rotation, Move, Arrangement, transform, standardOrientation, getStandardSideOrientation, inspectSide, locateSide, MoveType, toRotation, rotateArrangement, getAxis, isPositive, sideRotations, opposite, toNotation, toLetter, oppositeColor, COLORS, printArrangement, reverse, Orientation, itemList, toOrdinal, range, deepCopy } from './core';

function horizontalRotation(top: boolean, src: Side, dest: Side): Move | null {
  const srcPerspective = getStandardSideOrientation(src);
  const relativeDest = locateSide(dest, srcPerspective);
  const rotateSide = top ? Side.Up : Side.Down;
  const moveType = (() => {
    switch (relativeDest) {
      case Side.Front: return null;
      case Side.Left: return top ? MoveType.CW : MoveType.CCW;
      case Side.Right: return top ? MoveType.CCW : MoveType.CW;
      case Side.Back: return MoveType.Double;
      default: return null;
    }
  })();
  if (moveType == null) return null;
  return {
    side: rotateSide,
    type: moveType,
    orientation: srcPerspective,
  };
}

enum SolveProcedure {
  Orientation,
  Centers,
  EdgePairing,
  UpEdges,
  UpCorners,
  SideEdges,
  DownEdges,
  DownCorners,
}

export function* solve(arr: Arrangement, degree: number) {
  const arrangement = deepCopy(arr);

  const applyMove = (move: Move) => {
    const rot = toRotation(move, degree);
    rotateArrangement(rot, arrangement, degree);
  };

  const cornerSpaces = [0, degree - 1, degree * (degree - 1), degree * degree - 1];
  const cornerSpaceCircle = [cornerSpaces[0], cornerSpaces[1], cornerSpaces[3], cornerSpaces[2]];
  const cornerSpaceEdges = [
    [Side.Left, Side.Up],
    [Side.Right, Side.Up],
    [Side.Left, Side.Down],
    [Side.Right, Side.Down],
  ];

  const edgeSpaces = [
    Math.floor(degree / 2 - 0.1),  /* -0.1 in a floor of half essentially subtracts 1 but only to even degrees */
    degree * Math.floor(degree / 2),
    degree * Math.floor(degree / 2 + 0.9 /* 0.9 in a floor of half essentially adds 1 but only to odd degrees */) - 1,
    degree * (degree - 1) + Math.floor(degree / 2)];
  const edgeSpaceCircle = [edgeSpaces[0], edgeSpaces[2], edgeSpaces[3], edgeSpaces[1]];
  const edgeEdges = [Side.Up, Side.Left, Side.Right, Side.Down];

  // centers only used in even
  const centerSpaces = [
    degree * (Math.floor(degree / 2) - 1) + Math.floor(degree / 2) - 1,
    degree * (Math.floor(degree / 2) - 1) + Math.floor(degree / 2),
    degree * Math.floor(degree / 2) + Math.floor(degree / 2) - 1,
    degree * Math.floor(degree / 2) + Math.floor(degree / 2)
  ];
  const centerSpaceCircle = [centerSpaces[0], centerSpaces[1], centerSpaces[3], centerSpaces[2]];

  const edgeSpacePairs = [
    [edgeSpaces[0], edgeSpaces[0] + 1],
    [edgeSpaces[1], edgeSpaces[1] - degree],
    [edgeSpaces[2], edgeSpaces[2] + degree],
    [edgeSpaces[3], edgeSpaces[3] - 1],
  ];
  const alternateEdgeSpaceCircle = [edgeSpacePairs[0][1], edgeSpacePairs[2][1], edgeSpacePairs[3][1], edgeSpacePairs[1][1]];

  const sideCircle = [Side.Front, Side.Right, Side.Back, Side.Left];
  const sideColors: Color[/*side*/] = COLORS;

  let steps: SolveProcedure[] = (() => {
    switch (degree) {
      case 4:
        return [
          SolveProcedure.Centers,
          SolveProcedure.EdgePairing,
          SolveProcedure.UpEdges,
          SolveProcedure.UpCorners,
          SolveProcedure.SideEdges,
          SolveProcedure.DownEdges,
          SolveProcedure.DownCorners,
        ];
      case 3:
        return [
          SolveProcedure.Orientation,
          SolveProcedure.UpEdges,
          SolveProcedure.UpCorners,
          SolveProcedure.SideEdges,
          SolveProcedure.DownEdges,
          SolveProcedure.DownCorners,
        ];
      default: // 2
        return [
          SolveProcedure.UpCorners,
          SolveProcedure.DownCorners
        ];
    }
  })();



  // ensure proper orientation
  for (let iStep = 0; iStep < steps.length; iStep++) {
    let move: Move;

    printArrangement(arrangement, degree);
    switch (steps[iStep]) {

      case SolveProcedure.Orientation: {
        if (degree % 2 == 1) {
          let currentOrientation: Orientation = {
            top: +arrangement[Side.Up][Math.floor(degree / 2) * degree + Math.floor(degree / 2)],
            front: +arrangement[Side.Front][Math.floor(degree / 2) * degree + Math.floor(degree / 2)]
          };
          if (!(currentOrientation.top == standardOrientation.top && currentOrientation.front == standardOrientation.front)) {
            yield { text: "Rotate the cube.<br/>Put Green's center on top,<br/>put Red's center in front.", level: 0 };

            printArrangement(arrangement, degree);
            const upLocation = locateSide(Side.Up, currentOrientation);
            switch (upLocation) {
              case Side.Up: break;
              case Side.Back:
              case Side.Front:
                move = {
                  orientation: standardOrientation,
                  side: Side.Right,
                  layer: { depth: degree, thick: true },
                  type: upLocation == Side.Front ? MoveType.CW : MoveType.CCW
                }; applyMove(move); yield move;
                break;
              case Side.Left:
              case Side.Right:
                move = {
                  orientation: standardOrientation,
                  side: Side.Front,
                  layer: { depth: degree, thick: true },
                  type: upLocation == Side.Left ? MoveType.CW : MoveType.CCW
                }; applyMove(move); yield move;
                break;
              case Side.Down:
                move = {
                  orientation: standardOrientation,
                  side: Side.Right,
                  layer: { depth: degree, thick: true },
                  type: MoveType.Double
                }; applyMove(move); yield move;
                break;
            }

            printArrangement(arrangement, degree);
            currentOrientation = {
              top: +arrangement[Side.Up][Math.floor(degree / 2) * degree + Math.floor(degree / 2)],
              front: +arrangement[Side.Front][Math.floor(degree / 2) * degree + Math.floor(degree / 2)]
            };
            const frontLocation = locateSide(Side.Front, currentOrientation);
            const turns = sideCircle.findIndex(s => s == frontLocation);
            if (turns > 0) {
              move = {
                orientation: standardOrientation,
                side: Side.Up,
                layer: { depth: degree, thick: true },
                type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;
            }
            printArrangement(arrangement, degree);
          }
        }
      }
        break;

      case SolveProcedure.Centers: {
        yield { text: 'Centers', level: 1 };

        // We'll perform the same algorithm for 5 sides (6th side will be finished by 5 being finished).
        // First side will be Up, followed by all the side sides.
        // With the subject side at the top, move the 4 subject center spaces into that side (without messing up previously set centers).
        for (let t = 0; t < 5; t++) {
          const perspective = t == 0 ? { top: Side.Up, front: Side.Front } : { top: sideCircle[t - 1], front: Side.Down };
          yield { text: `${toLetter(perspective.top)} Center`, level: 2 };
          const expectedColor = sideColors[perspective.top];

          // The algorithm is written for the standard perspective (Up/Front) -- it simply sets the above perspective on the moves.
          // The only other part that needs to change based on the perspective is the actual checking of the arrangement (see below 2 functions),
          // to help this we convert center spaces of a side of the perspective to the corresponding "absolute" spaces of the standard perspective (which the arrangement is set in).
          const absCenterSpaces: number[/* perspective side */][] = (() => {
            let result = [];
            if (t == 0) {
              // first perspective is the standard perspective
              for (let i = 0; i < 6; i++) result.push(centerSpaces);
            } else {
              // other perspectives are Down at the front and a side at the top
              result =
                [
                    /*right*/[centerSpaces[2], centerSpaces[0], centerSpaces[3], centerSpaces[1]],
                    /*left */[centerSpaces[1], centerSpaces[3], centerSpaces[0], centerSpaces[2]],
                    /*up   */centerSpaces,
                    /*down */[...centerSpaces].reverse(),
                ];
                /*front*/result.push(result[[Side.Up, Side.Left, Side.Down, Side.Right][t - 1]]);
                /*back */result.push(result[[Side.Down, Side.Left, Side.Up, Side.Right][t - 1]]);
            }
            return result;
          })();
          const getAdjacentCenterSpace = (space: number, cw: boolean) => centerSpaceCircle[(centerSpaceCircle.findIndex(s => s == space) + (cw ? 1 : 3)) % 4];
          const assessCenters = (relativeSide: Side, expectedColor: Color) => {
            for (let iSpace = 0; iSpace < 4; iSpace++) {
              const relSpace = centerSpaces[iSpace];
              const absSpace = absCenterSpaces[relativeSide][iSpace];
              const absSide = inspectSide(relativeSide, perspective);
              if (arrangement[absSide][absSpace] == expectedColor) {
                const relCWSpace = getAdjacentCenterSpace(relSpace, true);
                const relDSpace = getAdjacentCenterSpace(relCWSpace, true);
                const relCCWSpace = getAdjacentCenterSpace(relSpace, false);
                const absCWSpace = getAdjacentCenterSpace(absSpace, true);
                const absDSpace = getAdjacentCenterSpace(absCWSpace, true);
                const absCCWSpace = getAdjacentCenterSpace(absSpace, false);
                const [cwSet, dSet, ccwSet] = [absCWSpace, absDSpace, absCCWSpace].map(s => arrangement[absSide][s] == expectedColor);

                return {
                  count: 1 + (cwSet ? 1 : 0) + (ccwSet ? 1 : 0) + ((cwSet || ccwSet) && dSet ? 1 : 0),
                  firstSpace: (!ccwSet) ? relSpace : (!dSet) ? relCCWSpace : relDSpace,
                }
              }
            }
            return {
              count: 0,
              firstSpace: 0,
            }
          };

          // Pretty much none of the rest of the code below has to worry about absolute sides, only the sides relative to the perspective.
          // (the only exception is where we set up a second perspective below, relative to the perspective)

          let spacesSet = 0;
          let normalSecondSpace = true;

          /* get first space */
          console.log(`aligning pre-existing ${toLetter(perspective.top)} center spaces`);
          // check if one's already there
          const topCenters = assessCenters(Side.Up, expectedColor);
          spacesSet = topCenters.count;
          yield { text: `Align ${itemList(range(1, spacesSet).map(n => toOrdinal(n)))} Space${spacesSet >= 2 ? 's' : ''}`, level: 3 };
          if (spacesSet > 0) {
            if (spacesSet != 4) {
              // rotate into position
              const ccwTurns = (centerSpaceCircle.findIndex(s => s == topCenters.firstSpace) + (topCenters.count == 3 ? 1 : 0)) % 4;
              if (ccwTurns != 0) {
                move = {
                  orientation: perspective,
                  side: Side.Up,
                  type: ccwTurns == 1 ? MoveType.CCW : ccwTurns == 2 ? MoveType.Double : MoveType.CW
                }; applyMove(move); yield move;
              }
            }
          }

          // look for space on the sides
          /* we will use roughly the method for the all the spaces, so loop */
          let iIt = -1;
          while (spacesSet < 4 && iIt < 4) { // iIt is an infinite-loop catch
            iIt++;
            //printArrangement(arrangement, degree);
            console.log(`looking for ${toLetter(perspective.top)} spaces (found ${spacesSet} so far)`);

            let bestSide: Side = 0;
            let bestCenters = { count: 0, firstSpace: 0 };
            for (let side = 0; side < 6; side++) {
              if (side == Side.Up) continue;
              const sideCenters = assessCenters(side, expectedColor);
              if (sideCenters.count > bestCenters.count) {
                bestSide = side;
                bestCenters = sideCenters;
                if (bestCenters.count == 4) break;
              }
            }
            console.log(`Best is ${toLetter(bestSide)} with ${bestCenters.count} spaces at ${bestCenters.firstSpace}`);

            // This is essentially the standard perspective of the bestSide *relative to* the perspective we're in.
            const relativeSidePerspective = getStandardSideOrientation(bestSide);
            // Need to convert to "absolute" perspective since the moves will execute based on this.
            const sidePerspective = { top: inspectSide(relativeSidePerspective.top, perspective), front: inspectSide(relativeSidePerspective.front, perspective) };

            {
              const centerCount = bestCenters.count == 3 ? 2 : bestCenters.count;
              yield { text: `Set ${itemList(range(spacesSet + 1, spacesSet + centerCount).map(n => toOrdinal(n)))} Space${centerCount >= 2 ? 's' : ''}`, level: 3 };
            }

            if (bestCenters.count == 4) {
              // move them all up
              console.log('moving all 4!');
              move = {
                orientation: sidePerspective,
                side: Side.Right,
                layer: { depth: degree / 2, thick: false },
                type: (bestSide == Side.Down) ? MoveType.Double : MoveType.CW
              }; applyMove(move); yield move;
              move = {
                orientation: sidePerspective,
                side: Side.Left,
                layer: { depth: degree / 2, thick: false },
                type: (bestSide == Side.Down) ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;

              spacesSet = 4;
            } else {
              // found one or two

              // line up the first space
              const effectiveBestSide = (bestSide == Side.Down ? Side.Front : bestSide);
              const zeroThree = spacesSet == 0 || spacesSet == 3;

              const turns = (
                sideCircle.findIndex(s => s == effectiveBestSide)
                - centerSpaceCircle.findIndex(s => s == bestCenters.firstSpace)
                + (4 * 10) // buffer for subtractions
                + ((bestCenters.count > 1 && ((getAxis(effectiveBestSide) == Axis.Z) == (zeroThree))) ? -1 : 0)
                + (!zeroThree ? (getAxis(effectiveBestSide) == Axis.Z ? 1 : -1) : 0)
              ) % 4;
              if (turns > 0) {
                console.log('lining up center space(s)');
                move = {
                  orientation: sidePerspective,
                  side: Side.Front,
                  type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW
                }; applyMove(move); yield move;
              }

              const moveRight = (bestSide == Side.Right || bestSide == Side.Back) == (spacesSet == 0);

              // align injection space
              if (spacesSet == 2 && (getAxis(effectiveBestSide) == Axis.Z)) {
                console.log('lining up space 3 injection space');
                move = {
                  orientation: perspective,
                  side: Side.Up,
                  type: (getAxis(effectiveBestSide) == Axis.Z) ? MoveType.CCW : MoveType.CW
                }; applyMove(move); yield move;
              }
              if (spacesSet == 3 || t > 0) {
                console.log('lining up injection space');
                if (spacesSet != 3) {
                  // make room for injection space
                  move = {
                    orientation: sidePerspective,
                    side: Side.Front,
                    type: MoveType.Double
                  }; applyMove(move); yield move;
                }
                // bring down injection space
                move = {
                  orientation: sidePerspective,
                  side: moveRight ? Side.Right : Side.Left,
                  layer: { depth: degree / 2, thick: true },
                  type: bestSide == Side.Down ? MoveType.Double : moveRight ? MoveType.CCW : MoveType.CW
                }; applyMove(move); yield move;
                // inject
                move = {
                  orientation: sidePerspective,
                  side: Side.Front,
                  type: spacesSet != 3 ? MoveType.Double : (getAxis(effectiveBestSide) == Axis.Z) ? MoveType.CW : MoveType.CCW
                }; applyMove(move); yield move;
              }

              console.log('moving');
              // move it up
              move = {
                orientation: sidePerspective,
                side: moveRight ? Side.Right : Side.Left,
                layer: { depth: degree / 2, thick: true },
                type: bestSide == Side.Down ? MoveType.Double : moveRight ? MoveType.CW : MoveType.CCW
              }; applyMove(move); yield move;

              const prevSpacesSet = spacesSet;
              spacesSet += bestCenters.count > 1 ? 2 : 1;

              // if we just moved the second space to a weird spot, put it in the normal spot
              const finalizeTurn =
                (prevSpacesSet == 0 && spacesSet == 2 && getAxis(effectiveBestSide) == Axis.Z) ? MoveType.CW
                  : (prevSpacesSet == 1) ? (
                    (spacesSet == 2 && getAxis(effectiveBestSide) == Axis.X) ? MoveType.CW
                      : (spacesSet == 3) ? ((getAxis(effectiveBestSide) == Axis.X) ? MoveType.CW : MoveType.CCW)
                        : null
                  )
                    : null;

              if (finalizeTurn != null) {
                console.log(`realigning centers`);
                move = {
                  orientation: perspective,
                  side: Side.Up,
                  type: finalizeTurn
                }; applyMove(move); yield move;
              }
            }
          }
        }
        yield { text: '', level: 0 };
      } break;

      case SolveProcedure.EdgePairing: {
        yield { text: 'Pair Edges', level: 1 };

        const allUniqueEdges = (() => {
          let result = [];
          const [upOr, downOr, frontOr, backOr] = [Side.Up, Side.Down, Side.Front, Side.Back].map(s => getStandardSideOrientation(s));
          for (let iEdge = 0; iEdge < 4; iEdge++) {
            result.push({ side: Side.Up, iEdge, adjacentSide: inspectSide(edgeEdges[iEdge], upOr), iAdjacentEdge: 0 });
            result.push({ side: Side.Down, iEdge, adjacentSide: inspectSide(edgeEdges[iEdge], downOr), iAdjacentEdge: 3 });
          }
          for (let iEdge = 1; iEdge <= 2; iEdge++) {
            result.push({ side: Side.Front, iEdge, adjacentSide: inspectSide(edgeEdges[iEdge], frontOr), iAdjacentEdge: (iEdge == 1) ? 2 : 1 });
            result.push({ side: Side.Back, iEdge, adjacentSide: inspectSide(edgeEdges[iEdge], backOr), iAdjacentEdge: (iEdge == 1) ? 2 : 1 });
          }
          return result;
        })();

        let setPairs = -1;
        for (let t = 0; t < allUniqueEdges.length; t++) { // note we will break out early if we solve them all
          let newSetPairs = 0;
          for (let iUE = 0; iUE < allUniqueEdges.length; iUE++) {
            const ue1 = allUniqueEdges[iUE];
            // edge 1 will always be pair index 0 (to simplify. since we check all 12 pairs for mismatches, we will definitely get all the edges)
            const color1 = arrangement[ue1.side][edgeSpacePairs[ue1.iEdge][0]];
            const adjacentColor1 = arrangement[ue1.adjacentSide][edgeSpacePairs[ue1.iAdjacentEdge][1]];

            // skip if edge's pair already matches
            if (color1 == arrangement[ue1.side][edgeSpacePairs[ue1.iEdge][1]]
              && adjacentColor1 == arrangement[ue1.adjacentSide][edgeSpacePairs[ue1.iAdjacentEdge][0]]) {
              newSetPairs++;
            }
          }
          //printArrangement(arrangement, degree);
          console.log(`set pairs: ${newSetPairs}`);
          if (newSetPairs - setPairs > 1) console.log('bonus pairs matched!');
          else if (newSetPairs - setPairs < 1) console.log('lost some pairs!');
          setPairs = newSetPairs;
          if (setPairs == allUniqueEdges.length) break;

          let solvedPair = false;
          for (let iUE = 0; iUE < allUniqueEdges.length; iUE++) {
            const ue1 = allUniqueEdges[iUE];
            // edge 1 will always be pair index 0 (to simplify. since we check all 12 pairs for mismatches, we will definitely get all the edges)
            const color1 = arrangement[ue1.side][edgeSpacePairs[ue1.iEdge][0]];
            const adjacentColor1 = arrangement[ue1.adjacentSide][edgeSpacePairs[ue1.iAdjacentEdge][1]];

            // skip if edge's pair already matches
            if (color1 == arrangement[ue1.side][edgeSpacePairs[ue1.iEdge][1]]
              && adjacentColor1 == arrangement[ue1.adjacentSide][edgeSpacePairs[ue1.iAdjacentEdge][0]]) {
              continue;
            }

            {
              const colorSides = [color1, adjacentColor1].map(c => sideColors.findIndex(c2 => c2 == c));
              colorSides.sort(s => getAxis(s));
              yield { text: `${toOrdinal(setPairs + 1)} Edge (${toLetter(colorSides[1])}${toLetter(colorSides[0])})`, level: 2 };
            }
            yield { text: 'Align', level: 3 };

            //printArrangement(arrangement, degree);
            console.log(`Matching ${Color[color1]}/${Color[adjacentColor1]} pair at ${toLetter(ue1.side)}@edge${ue1.iEdge}`);

            const perspective = getStandardSideOrientation(ue1.side);

            // move ue1 to iEdge 1
            const turns = (
              edgeSpaceCircle.findIndex(s => s == edgeSpaces[1])
              - edgeSpaceCircle.findIndex(s => s == edgeSpacePairs[ue1.iEdge][0])
              + 4) % 4;
            if (turns != 0) {
              console.log('Moving to edge 1');
              move = {
                orientation: perspective,
                side: Side.Front,
                type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;
            }

            // find its pair
            for (let jUE = 0; jUE < allUniqueEdges.length; jUE++) {
              const ue2 = allUniqueEdges[jUE];
              // make sure we didn't just find ue1 again (but we moved ue1 so can't just compare iUE and jUE)
              if ((ue2.side == ue1.side && ue2.iEdge == 1) || (ue2.adjacentSide == ue1.side && ue2.iEdge == 1)) continue;

              for (let iPairEl = 0; iPairEl < 2; iPairEl++) {
                const color2 = arrangement[ue2.side][edgeSpacePairs[ue2.iEdge][iPairEl]];
                const adjacentColor2 = arrangement[ue2.adjacentSide][edgeSpacePairs[ue2.iAdjacentEdge][+!iPairEl]];

                if (!((color1 == color2 && adjacentColor1 == adjacentColor2)
                  || (color1 == adjacentColor2 && adjacentColor1 == color2))) {
                  // nope!
                  continue;
                }

                // identify where the other color is relative to the perspective
                const colorOn2Adjacent = color1 == adjacentColor2;
                const colorSide2 = colorOn2Adjacent ? ue2.adjacentSide : ue2.side;
                let relColorSide2 = locateSide(colorSide2, perspective);
                const colorIEdge2 = colorOn2Adjacent ? ue2.iAdjacentEdge : ue2.iEdge;
                let relColorIEdge2 = (() => {
                  if (perspective.front == Side.Up || perspective.front == Side.Down) {
                    // note -- This is not _actually_ the relative space, but rather the pair index 0 space of its edge. 
                    //         Doesn't matter since we're just trying to get the index of the edge pair.
                    const relSpace = edgeSpaceCircle[
                      (
                        edgeSpaceCircle.findIndex(s => s == edgeSpaces[colorIEdge2])
                        + (relColorSide2 == Side.Front ? 0
                          : relColorSide2 == Side.Back ? 2
                            : (sideCircle.findIndex(s => s == colorSide2) * (perspective.front == Side.Up ? -1 : 1)))
                        + 4)
                      % 4];
                    return edgeSpaces.findIndex(s => s == relSpace);
                  }
                  else if (relColorSide2 == Side.Up || relColorSide2 == Side.Down) {
                    const relSpace = edgeSpaceCircle[
                      (
                        edgeSpaceCircle.findIndex(s => s == edgeSpaces[colorIEdge2])
                        + (sideCircle.findIndex(s => s == perspective.front) * (relColorSide2 == Side.Up ? 1 : -1))
                        + 4)
                      % 4];
                    return edgeSpaces.findIndex(s => s == relSpace);
                  }
                  else
                    return ue2.iEdge;
                })();

                //printArrangement(arrangement, degree);
                console.log(`matched with ${Color[color2]}/${Color[adjacentColor2]} pair at ${toLetter(colorSide2)}@edge${colorIEdge2}`);

                if (relColorSide2 == Side.Front && relColorIEdge2 != 2) {
                  // flip it to the back
                  console.log('flipping front to back');
                  const top = relColorIEdge2 == 0;
                  move = {
                    orientation: perspective,
                    side: top ? Side.Up : Side.Down,
                    type: MoveType.Double
                  }; applyMove(move); yield move;

                  relColorSide2 = Side.Back;
                  // iEdge is the same.
                } else if (relColorSide2 == Side.Right || relColorSide2 == Side.Left) {
                  let rotated = false;
                  if (relColorIEdge2 == 1 || relColorIEdge2 == 2) {
                    rotated = true;
                    console.log('rotating');
                    // rotate to top/bottom
                    move = {
                      orientation: perspective,
                      side: relColorSide2,
                      type: MoveType.CW
                    }; applyMove(move); yield move;

                    relColorIEdge2 = relColorIEdge2 == 1 ? 0 : 3;
                  }

                  console.log('flipping side to back');
                  // flip it to the back
                  const top = relColorIEdge2 == 0;
                  move = {
                    orientation: perspective,
                    side: top ? Side.Up : Side.Down,
                    type: (relColorSide2 == Side.Right) == top ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); yield move;

                  // if this was the left side then we just messed up ue1
                  if (rotated && relColorSide2 == Side.Left) {
                    // restore
                    move = {
                      orientation: perspective,
                      side: relColorSide2,
                      type: MoveType.CCW
                    }; applyMove(move); yield move;
                  }

                  relColorSide2 = Side.Back;
                  // iEdge is the same.
                }

                // now it should be on Up, Down, or Back.

                // rotate into injection point
                const turns = (
                  edgeSpaceCircle.findIndex(s => s == edgeSpaces[relColorSide2 == Side.Back ? 1 : 2])
                  - edgeSpaceCircle.findIndex(s => s == edgeSpaces[relColorIEdge2])
                  + 4
                ) % 4;
                if (turns > 0) {
                  console.log('positioning');
                  move = {
                    orientation: perspective,
                    side: relColorSide2,
                    type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW
                  }; applyMove(move); yield move;
                }

                if (relColorSide2 != Side.Front) {
                  console.log('moving');
                  // inject
                  move = {
                    orientation: perspective,
                    side: Side.Right,
                    type: relColorSide2 == Side.Up ? MoveType.CCW : relColorSide2 == Side.Back ? MoveType.Double : MoveType.CW
                  }; applyMove(move); yield move;
                }

                console.log('edge pairing');
                yield { text: 'Connect', level: 3 };
                // edge pairing algorithm:
                const moves = [
                  { side: Side.Down, type: MoveType.CW, layer: { depth: degree / 2, thick: true } },
                  { side: Side.Right, type: MoveType.CW },
                  { side: Side.Front, type: MoveType.CCW },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.CCW },
                  { side: Side.Front, type: MoveType.CW },
                  { side: Side.Down, type: MoveType.CCW, layer: { depth: degree / 2, thick: true } },
                ];
                for (let iMove = 0; iMove < moves.length; iMove++) {
                  move = {
                    orientation: perspective,
                    ...moves[iMove]
                  }; applyMove(move); yield move;
                }

                solvedPair = true;
                break;
              }
              if (solvedPair) break;
            }

            if (!solvedPair) console.log(`Couldn't find a pair!`);
            break;
          }

          if (!solvedPair) break;
        }
      } break;

      case SolveProcedure.UpEdges: {
        yield { text: 'Upper Cross', level: 1 };

        let iIt = -1;
        while (iIt < 15) { // iIt is an infinite-loop catch
          iIt++;
          //printArrangement(arrangement, degree);
          let solvedEdge = false;
          for (let side = 0; side < 6; side++) {
            for (let iEdge = 0; iEdge < 4; iEdge++) {
              let space = edgeSpaces[iEdge];
              if (arrangement[side][space] == Color.Green) {
                console.log(`Fixing green edge ${toLetter(side)}@${space}`);

                const sideOrientation = getStandardSideOrientation(side);
                const zeroThree = iEdge == 0 || iEdge == 3;

                const moveDownMoves = [];

                /* bring to bottom */
                if (side == Side.Up) {
                  const edgeEdge = edgeEdges[iEdge];
                  const adjacentSide = inspectSide(edgeEdge, sideOrientation);

                  /* check if it's already solved */
                  if (arrangement[adjacentSide][edgeSpaces[0]] == sideColors[adjacentSide]) {
                    console.log('Nevermind');
                    continue;
                  }

                  move = {
                    orientation: standardOrientation,
                    side: adjacentSide,
                    type: MoveType.Double
                  }; applyMove(move); moveDownMoves.push(move);

                  side = Side.Down;
                  space = iEdge == 0 ? edgeSpaces[3] : iEdge == 3 ? edgeSpaces[0] : space;
                } else if (side != Side.Down) {
                  if (zeroThree) {
                    /* move to the side (restore later) */
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: MoveType.CW,
                    }; applyMove(move); moveDownMoves.push(move);
                    space = edgeSpaces[iEdge == 0 ? 2 : 1];
                  }

                  // move down
                  move = {
                    orientation: sideOrientation,
                    side: space == edgeSpaces[2] ? Side.Right : Side.Left,
                    type: space == edgeSpaces[2] ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); moveDownMoves.push(move);

                  // move away 
                  move = {
                    orientation: sideOrientation,
                    side: Side.Down,
                    type: space == edgeSpaces[2] ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); moveDownMoves.push(move);

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: space == edgeSpaces[2] ? Side.Right : Side.Left,
                    type: space == edgeSpaces[2] ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); moveDownMoves.push(move);

                  if (zeroThree) {
                    // restore
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: MoveType.CCW,
                    }; applyMove(move); moveDownMoves.push(move);
                  }

                  space = edgeSpaceCircle[(sideCircle.findIndex(s => s == side) + 2) % 4];
                  side = Side.Down;
                }

                console.log(`Located down @ ${space}`);

                /* put in place */
                const edgeEdge = edgeEdges[edgeSpaces.findIndex(s => s == space)];
                const adjacentSide = inspectSide(edgeEdge, getStandardSideOrientation(Side.Down));
                const targetSide = sideColors.findIndex(c => c == arrangement[adjacentSide][edgeSpaces[3]]);

                yield { text: `${toLetter(targetSide)} Edge`, level: 2 };
                for (let i = 0; i < moveDownMoves.length; i++) {
                  yield moveDownMoves[i];
                }

                const colorPerspective = getStandardSideOrientation(targetSide);
                move = horizontalRotation(false, adjacentSide, targetSide);
                if (move != null) {
                  move = transform(move, colorPerspective);
                  applyMove(move); yield move;
                }

                // move up
                move = {
                  orientation: colorPerspective,
                  side: Side.Front,
                  type: MoveType.Double
                }; applyMove(move); yield move;

                solvedEdge = true;
                break;
              }
            }
            if (solvedEdge) break;
          }
          if (!solvedEdge) break;
        }

        yield { text: '', level: 0 };
      } break;

      case SolveProcedure.UpCorners: {
        yield { text: 'Upper Corners', level: 1 };

        let attempt = -1;
        while (attempt < 15) { // attempt is an infinite-loop catch
          attempt++
          //printArrangement(arrangement, degree);
          let setSpace = false;
          for (let side = 0; side < 6; side++) {
            for (let iSpace = 0; iSpace < 4; iSpace++) {
              let space = cornerSpaces[iSpace]
              if (arrangement[side][space] == Color.Green) {
                console.log(`fixing green corner ${toLetter(side)}@${space}`);

                const moveDownMoves = [];

                /* get into side bottom row */
                if (side == Side.Up) {
                  /* check it's not already in the right space */
                  const sideOrientation = getStandardSideOrientation(side);
                  const zeroThree = space == cornerSpaces[0] || space == cornerSpaces[3];
                  const [xEdge, yEdge] = cornerSpaceEdges[iSpace];
                  const xSide = inspectSide(xEdge, sideOrientation);
                  const xSpace = zeroThree ? cornerSpaces[0] : cornerSpaces[1];
                  if (arrangement[xSide][xSpace] == sideColors[xSide]) {
                    console.log('nevermind');
                    continue;
                  }

                  // move down
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: zeroThree ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); moveDownMoves.push(move);

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Back,
                    type: zeroThree ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); moveDownMoves.push(move);

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: zeroThree ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); moveDownMoves.push(move);

                  side = inspectSide(opposite(xEdge), sideOrientation);
                  space = zeroThree ? cornerSpaces[3] : cornerSpaces[2];
                } else if (side == Side.Down) {
                  const sideOrientation = getStandardSideOrientation(side);
                  const iFreeTopSpace = (() => {
                    for (let iTopSpace = 0; iTopSpace < 4; iTopSpace++) {
                      if (arrangement[Side.Up][cornerSpaces[iTopSpace]] != Color.Green) {
                        return iTopSpace;
                      }
                    }
                  })();
                  const freeBottomSpace = cornerSpaces[(iFreeTopSpace + 2) % 4];
                  let turns = 0;
                  let attempt2 = -1; // infinite loop catch
                  for (let iSC = cornerSpaceCircle.findIndex(s => s == space); cornerSpaceCircle[iSC] != freeBottomSpace && attempt2 < 15; iSC = (iSC + 1) % 4, turns++, attempt2++);
                  if (turns != 0) {
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: (turns == 1) ? MoveType.CW : (turns == 2) ? MoveType.Double : MoveType.CCW
                    }; applyMove(move); moveDownMoves.push(move);

                    space = freeBottomSpace;
                  }

                  const [xEdge, yEdge] = cornerSpaceEdges[cornerSpaces.findIndex(s => s == space)];
                  const zeroThree = space == cornerSpaces[0] || space == cornerSpaces[3];
                  // move up
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: (zeroThree) ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); moveDownMoves.push(move);

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Front,
                    type: (zeroThree) ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); moveDownMoves.push(move);

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: (zeroThree) ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); moveDownMoves.push(move);

                  side = inspectSide(opposite(xEdge), sideOrientation);
                  space = (zeroThree) ? cornerSpaces[3] : cornerSpaces[2];

                } else if (space < cornerSpaces[2]) { // side top row
                  const sideOrientation = getStandardSideOrientation(side);
                  const [xEdge, yEdge] = cornerSpaceEdges[iSpace];

                  // move down
                  move = {
                    orientation: sideOrientation,
                    side: Side.Front,
                    type: (space == cornerSpaces[0]) ? MoveType.CCW : MoveType.CW,
                  }; applyMove(move); moveDownMoves.push(move);

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Down,
                    type: (space == cornerSpaces[0]) ? MoveType.CCW : MoveType.CW,
                  }; applyMove(move); moveDownMoves.push(move);

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: Side.Front,
                    type: (space == cornerSpaces[0]) ? MoveType.CW : MoveType.CCW,
                  }; applyMove(move); moveDownMoves.push(move);

                  side = inspectSide(xEdge, sideOrientation);
                  space = cornerSpaces[cornerSpaces.findIndex(s => s == space) + 2];
                }

                /* move into appropriate top spot */
                const sideOrientation = getStandardSideOrientation(side);
                const [xEdge, yEdge] = cornerSpaceEdges[cornerSpaces.findIndex(s => s == space)];
                const [xSide] = [inspectSide(xEdge, sideOrientation)];
                const xColor = arrangement[xSide][space == cornerSpaces[3] ? cornerSpaces[2] : cornerSpaces[3]]
                const xColorSide = sideColors.findIndex(c => c == xColor);
                {
                  const yColorSide = sideCircle[(sideCircle.findIndex(s => s == xColorSide) + (cornerSpaces.findIndex(s => s == space) == 2 ? 1 : 3)) % 4];

                  const [xAxisSide, zAxisSide] = getAxis(xColorSide) == Axis.X ? [xColorSide, yColorSide] : [yColorSide, xColorSide];
                  yield { text: `${toLetter(zAxisSide)}${toLetter(xAxisSide)} Corner`, level: 2 };
                  for (let i = 0; i < moveDownMoves.length; i++) {
                    yield moveDownMoves[i];
                  }
                }

                // prepare to inject
                move = horizontalRotation(false, side, opposite(xColorSide));
                if (move != null) {
                  move = transform(move, sideOrientation);
                  applyMove(move); yield move;
                }

                const colorOrientation = getStandardSideOrientation(xColorSide);
                // open injection
                move = {
                  orientation: colorOrientation,
                  side: Side.Front,
                  type: (space == cornerSpaces[2]) ? MoveType.CW : MoveType.CCW
                }; applyMove(move); yield move;

                // inject
                move = {
                  orientation: colorOrientation,
                  side: Side.Down,
                  type: (space == cornerSpaces[2]) ? MoveType.CCW : MoveType.CW,
                }; applyMove(move); yield move;

                // move up
                move = {
                  orientation: colorOrientation,
                  side: Side.Front,
                  type: (space == cornerSpaces[2]) ? MoveType.CCW : MoveType.CW
                }; applyMove(move); yield move;

                setSpace = true;
                break;
              }
            }
            if (setSpace) break;
          }
          if (!setSpace) break;
        }

        yield { text: '', level: 0 };
      }
        break;

      case SolveProcedure.SideEdges: {
        yield { text: 'Side Edges', level: 1 };

        const perspective = { top: Side.Down, front: Side.Back };
        let attempt = -1;
        while (attempt < 15) { // attempt is an infinite-loop catch
          attempt++
          //printArrangement(arrangement, degree);
          let solvedEdge = false;

          /* check for unsolved edges where blue should be */
          for (let iSC = 0; iSC < 4; iSC++) {
            const space = edgeSpaceCircle[iSC];
            const adjacentSide = sideCircle[iSC];
            const [spaceColor, adjacentColor] = [arrangement[Side.Down][space], arrangement[adjacentSide][edgeSpaces[3]]];

            if (spaceColor != Color.Blue && adjacentColor != Color.Blue) {
              console.log(`fixing blue edge ${space} with non-blue colors ${spaceColor} and ${adjacentColor}`);
              const [spaceColorSide, adjacentColorSide] = [spaceColor, adjacentColor].map(c => sideColors.findIndex(c2 => c2 == c));
              const clockwiseSetup = sideCircle.findIndex(s => s == adjacentColorSide) == (1 + sideCircle.findIndex(s => s == spaceColorSide)) % 4;

              {
                const [xAxisSide, zAxisSide] = (getAxis(spaceColorSide) == Axis.X) ? [spaceColorSide, adjacentColorSide] : [adjacentColorSide, spaceColorSide];
                yield { text: `${toLetter(zAxisSide)}${toLetter(xAxisSide)} Edge`, level: 2 };
              }

              // combined: line up edge with T, move away from other color
              move = horizontalRotation(false, adjacentSide, opposite(spaceColorSide));
              if (move != null) {
                move = transform(move, perspective);
                applyMove(move); yield move;
              }

              const remainingMoves = [
                { side: spaceColorSide, type: MoveType.CW },
                { side: Side.Down, type: MoveType.CCW },
                { side: spaceColorSide, type: MoveType.CCW },
                { side: Side.Down, type: MoveType.CCW },
                { side: adjacentColorSide, type: MoveType.CCW },
                { side: Side.Down, type: MoveType.CW },
                { side: adjacentColorSide, type: MoveType.CW }
              ];
              for (let i = 0; i < remainingMoves.length; i++) {
                move = transform({
                  orientation: standardOrientation,
                  side: remainingMoves[i].side,
                  type: clockwiseSetup ? remainingMoves[i].type : reverse(remainingMoves[i].type)
                }, { top: Side.Down, front: adjacentColorSide });
                applyMove(move); yield move;
              }

              solvedEdge = true;
              break;
            }
          }
          if (solvedEdge) continue;

          /* check for reversed edges */
          for (let iSide = 0; iSide < 4; iSide++) {
            const side = sideCircle[iSide];
            if (arrangement[side][edgeSpaces[2]] != sideColors[side]) {
              const adjacentSide = sideCircle[(iSide + 1) % 4];
              console.log(`fixing flipped edge ${toLetter(side)}@${edgeSpaces[2]}`);

              const remainingMoves = [
                { side: side, type: MoveType.CW },
                { side: Side.Down, type: MoveType.CCW },
                { side: side, type: MoveType.CCW },
                { side: Side.Down, type: MoveType.CCW },
                { side: adjacentSide, type: MoveType.CCW },
                { side: Side.Down, type: MoveType.CW },
                { side: adjacentSide, type: MoveType.CW }
              ];
              for (let i = 0; i < remainingMoves.length; i++) {
                move = transform({
                  orientation: standardOrientation,
                  ...remainingMoves[i]
                }, { top: Side.Down, front: side });
                applyMove(move); yield move;
              }

              solvedEdge = true;
              break;
            }
          }
          if (!solvedEdge) break;
        }

        yield { text: '', level: 0 };
      } break;

      case SolveProcedure.DownEdges: {
        yield { text: 'Down Cross', level: 1 };

        const perspective = { top: Side.Down, front: Side.Back };

        /* create the cross */
        // loop in case of parity
        let attempt = -1;
        while (attempt < 15) { // attempt is an infinite-loop catch
          attempt++;
          enum Layout {
            Cross,
            HorizontalLine, VerticalLine,
            NWAngle, NEAngle, SWAngle, SEAngle
          };
          let possibleLayouts: Layout[] = [];
          for (let i = 0; i < 7; i++) possibleLayouts.push(i);
          const layoutsByEdge: Layout[/* iEdge */][] = [
            [Layout.Cross, Layout.VerticalLine, Layout.NWAngle, Layout.NEAngle],
            [Layout.Cross, Layout.HorizontalLine, Layout.NWAngle, Layout.SWAngle],
            [Layout.Cross, Layout.HorizontalLine, Layout.NEAngle, Layout.SEAngle],
            [Layout.Cross, Layout.VerticalLine, Layout.SWAngle, Layout.SEAngle],
          ];
          // tracking potential parity edges
          let blueEdge: number = null;
          let nonBlueEdge: number = null;
          let blueEdgeCount = 0;
          for (let iEdge = 0; iEdge < 4; iEdge++) {
            if (arrangement[Side.Down][edgeSpaces[iEdge]] != Color.Blue) {
              nonBlueEdge = iEdge;
              layoutsByEdge[iEdge].forEach(l => {
                const iPL = possibleLayouts.findIndex(l2 => l2 == l);
                if (iPL != null) delete possibleLayouts[iPL];
              });
            } else {
              blueEdge = iEdge;
              blueEdgeCount++;
            }
          }

          if (degree >= 4 && blueEdgeCount % 2 == 1) {  // 3x3 never has parity
            yield { text: `Fix OLL Parity`, level: 2 };

            const parityEdge = blueEdgeCount == 1 ? blueEdge : nonBlueEdge;
            //printArrangement(arrangement, degree);
            console.log(`fixing OLL edge parity (on edge ${parityEdge})`);
            const parityPerspective = { top: Side.Down, front: inspectSide(edgeEdges[parityEdge], getStandardSideOrientation(Side.Down)) };

            const moves = [
              { side: Side.Right, type: MoveType.Double, layer: { depth: degree / 2, thick: false } },
              { side: Side.Back, type: MoveType.Double },
              { side: Side.Up, type: MoveType.Double },
              { side: Side.Left, type: MoveType.CW, layer: { depth: degree / 2, thick: false } },
              { side: Side.Up, type: MoveType.Double },
              { side: Side.Right, type: MoveType.CCW, layer: { depth: degree / 2, thick: false } },
              { side: Side.Up, type: MoveType.Double },
              { side: Side.Right, type: MoveType.CW, layer: { depth: degree / 2, thick: false } },
              { side: Side.Up, type: MoveType.Double },
              { side: Side.Front, type: MoveType.Double },
              { side: Side.Right, type: MoveType.CW, layer: { depth: degree / 2, thick: false } },
              { side: Side.Front, type: MoveType.Double },
              { side: Side.Left, type: MoveType.CCW, layer: { depth: degree / 2, thick: false } },
              { side: Side.Back, type: MoveType.Double },
              { side: Side.Right, type: MoveType.Double, layer: { depth: degree / 2, thick: false } },
            ];

            for (let iMove = 0; iMove < moves.length; iMove++) {
              move = {
                orientation: parityPerspective,
                ...moves[iMove]
              }; applyMove(move); yield move;
            }

            continue; // try to make the cross again
          }

          yield { text: `Create Cross`, level: 2 };

          possibleLayouts = possibleLayouts.filter(l => l != null);

          let iterations: number[]
          if (possibleLayouts.length > 1) {
            // we've got the cross
            if (possibleLayouts.findIndex(l => l == Layout.Cross) == null) console.log('Failed to assess the bottom edge layout.');
            iterations = [];
          }
          else if (possibleLayouts.length == 0) {
            iterations = [1, 2];
          }
          else {
            const layout = possibleLayouts[0];
            if (layout == Layout.Cross) iterations = []; // nice!
            else if (layout == Layout.HorizontalLine || layout == Layout.VerticalLine) {
              if (layout == Layout.VerticalLine) {
                // get to horizontal line
                move = {
                  orientation: perspective,
                  side: Side.Up,
                  type: MoveType.CW
                }; applyMove(move); yield move;
              }
              iterations = [1];
            } else {
              if (layout != Layout.NWAngle) {
                move = {
                  orientation: perspective,
                  side: Side.Up,
                  type: (layout == Layout.NEAngle) ? MoveType.CCW : (layout == Layout.SWAngle) ? MoveType.CW : MoveType.Double
                }; applyMove(move); yield move;
              }
              iterations = [2];
            }
          }

          //printArrangement(arrangement, degree);
          console.log(`Cross layout(s): ${possibleLayouts.join('+')}, doing iteration(s): ${iterations.join('+')}`);

          for (let iIt = 0; iIt < iterations.length; iIt++) {
            if (iIt == 1) {
              // previous it created a SE cross
              yield { text: '', level: 3 };
              move = {
                orientation: perspective,
                side: Side.Up,
                type: MoveType.Double
              }; applyMove(move); yield move;
            }

            if (iterations.length > 1) yield { text: `${toOrdinal(iIt + 1)} Part`, level: 3 };

            // enter the matrix
            move = {
              orientation: perspective,
              side: Side.Front,
              type: MoveType.CW
            }; applyMove(move); yield move;

            // algorithm
            for (let i = 0; i < iterations[iIt]; i++) {
              const moves = [
                { side: Side.Right, type: MoveType.CW },
                { side: Side.Up, type: MoveType.CW },
                { side: Side.Right, type: MoveType.CCW },
                { side: Side.Up, type: MoveType.CCW },
              ];
              for (let iMove = 0; iMove < 4; iMove++) {
                move = {
                  orientation: perspective,
                  ...moves[iMove]
                }; applyMove(move); yield move;
              }
            }

            // leave the matrix
            move = {
              orientation: perspective,
              side: Side.Front,
              type: MoveType.CCW
            }; applyMove(move); yield move;
          }

          break;
        }

        /* arrange the cross */
        {
          yield { text: 'Align Cross', level: 2 };
          let arrangePerspective = perspective;
          let attempt = -1;
          while (attempt < 15) { // attempt is an infinite-loop catch
            attempt++
            yield { text: '', level: 3 };
            //printArrangement(arrangement, degree);
            console.log('arranging bottom edges');

            /* orient to the best initial arrangement */
            let bestAligned = 0;
            let bestTurns = 0;
            for (let iTurns = 0; iTurns < 4; iTurns++) {
              let aligned = 0;
              for (let i = 0; i < 4; i++) {
                if (arrangement[sideCircle[i]][edgeSpaces[3]] == sideColors[sideCircle[i]]) aligned++;
              }
              if (aligned > bestAligned) {
                bestAligned = aligned;
                bestTurns = iTurns;
              }

              move = {
                orientation: arrangePerspective,
                side: Side.Up,
                type: MoveType.CW,
              }; applyMove(move); // intentional no-yield -- this is just a test, and we will do a full circuit here to restore
            }

            if (bestTurns > 0) {
              move = {
                orientation: arrangePerspective,
                side: Side.Up,
                type: (bestTurns == 1) ? MoveType.CW : (bestTurns == 2) ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;
            }

            if (bestAligned == 4) break;

            yield { text: 'Flip Two', level: 3 };

            /* flip a misaligned side with its adjacent */
            const misalignedSide = (() => {
              for (let i = 0; i < 4; i++) {
                if (arrangement[sideCircle[i]][edgeSpaces[3]] != sideColors[sideCircle[i]]) return sideCircle[i];
              }
            })();
            arrangePerspective = { top: Side.Down, front: misalignedSide };

            const moves = [
              { side: Side.Right, type: MoveType.CW },
              { side: Side.Up, type: MoveType.CW },
              { side: Side.Right, type: MoveType.CCW },
              { side: Side.Up, type: MoveType.CW },
              { side: Side.Right, type: MoveType.CW },
              { side: Side.Up, type: MoveType.CW },
              { side: Side.Up, type: MoveType.CW },
              { side: Side.Right, type: MoveType.CCW },
            ];
            for (let i = 0; i < moves.length; i++) {
              move = {
                orientation: arrangePerspective,
                ...moves[i]
              }; applyMove(move); yield move;
            }
          }
        }

        yield { text: '', level: 0 };
      } break;

      case SolveProcedure.DownCorners: {
        yield { text: 'Down Corners', level: 1 };
        const perspective = { top: Side.Down, front: Side.Back };

        // loop to do these steps twice in case of parity
        let attempt = -1;
        while (attempt < 15) { // attempt is an infinite-loop catch
          attempt++;
          /* position the corners */
          let posPerspective = perspective;
          const topRightPositioned = () => {
            const right = inspectSide(Side.Right, posPerspective);
            const front = inspectSide(Side.Front, posPerspective);
            const topRightColors = [
              arrangement[Side.Down][cornerSpaceCircle[sideCircle.findIndex(s => s == posPerspective.front)]],
              arrangement[right][cornerSpaces[3]],
              arrangement[front][cornerSpaces[2]]
            ];
            return topRightColors.some(c => c == sideColors[right])
              && topRightColors.some(c => c == sideColors[front]);
          };
          const topLeftPositioned = () => {
            const left = inspectSide(Side.Left, posPerspective);
            const front = inspectSide(Side.Front, posPerspective);
            const topRightColors = [
              arrangement[Side.Down][cornerSpaceCircle[(sideCircle.findIndex(s => s == posPerspective.front) + 1) % 4]],
              arrangement[left][cornerSpaces[2]],
              arrangement[front][cornerSpaces[3]]
            ];
            return topRightColors.some(c => c == sideColors[left])
              && topRightColors.some(c => c == sideColors[front]);
          }

          const cycleCornersMoves = [
            { side: Side.Up, type: MoveType.CW },
            { side: Side.Right, type: MoveType.CW },
            { side: Side.Up, type: MoveType.CCW },
            { side: Side.Left, type: MoveType.CCW },
            { side: Side.Up, type: MoveType.CW },
            { side: Side.Right, type: MoveType.CCW },
            { side: Side.Up, type: MoveType.CCW },
            { side: Side.Left, type: MoveType.CW },
          ];

          yield { text: 'Position Corners', level: 2 }
          let attempt2 = -1;
          while (attempt2 < 15) { // attempt2 is an infinite-loop catch
            attempt2++;
            /* try to find the right perspective */
            for (let i = 0; i < 4; i++) {
              if (topRightPositioned()) break;
              posPerspective = { top: Side.Down, front: sideCircle[(sideCircle.findIndex(s => s == posPerspective.front) + 1) % 4] };
            }

            if (!topRightPositioned()) {
              /* couldn't find it, fix with moves */
              if (attempt2 == 0) {
                yield { text: `1st Corner`, level: 3 };
              }

              //printArrangement(arrangement, degree);
              console.log(`top right not positioned (looking at ${toLetter(posPerspective.front)})`);

              if (degree <= 2) {
                // we can just rotate the top
                move = {
                  orientation: posPerspective,
                  side: Side.Up,
                  type: MoveType.CW
                }; applyMove(move); yield move;
              } else {
                // edges have been set - rotate corners with the cycle algorithm
                for (let i = 0; i < cycleCornersMoves.length; i++) {
                  move = {
                    orientation: posPerspective,
                    ...cycleCornersMoves[i]
                  }; applyMove(move); yield move;
                }
              }

              continue;
            }
            break;
          }

          yield {
            text: `${toLetter(inspectSide(Side.Front, posPerspective))}${toLetter(inspectSide(Side.Left, posPerspective))}`
              + `, ${toLetter(inspectSide(Side.Back, posPerspective))}${toLetter(inspectSide(Side.Left, posPerspective))}`
              + `, and ${toLetter(inspectSide(Side.Back, posPerspective))}${toLetter(inspectSide(Side.Right, posPerspective))} Corners`, level: 3
          };

          let attempt3 = -1;
          while (!topLeftPositioned() && attempt3 < 15) { // attempt3 is an infinite-loop catch
            attempt3++;
            //printArrangement(arrangement, degree);
            console.log(`top left not positioned (looking at ${toLetter(posPerspective.front)})`);

            for (let i = 0; i < cycleCornersMoves.length; i++) {
              move = {
                orientation: posPerspective,
                ...cycleCornersMoves[i]
              }; applyMove(move); yield move;
            }
          }

          /* check if the opposite two corners have parity */
          if (degree == 3) break; // 3x3 never has parity
          const backRightPositioned = () => {
            const right = inspectSide(Side.Right, posPerspective);
            const back = inspectSide(Side.Back, posPerspective);
            const backRightColors = [
              arrangement[Side.Down][cornerSpaceCircle[(sideCircle.findIndex(s => s == posPerspective.front) + 3) % 4]],
              arrangement[right][cornerSpaces[2]],
              arrangement[back][cornerSpaces[3]],
            ];
            return backRightColors.some(c => c == sideColors[right])
              && backRightColors.some(c => c == sideColors[back]);
          }

          yield { text: 'Fix PLL Parity', level: 2 };

          if (backRightPositioned()) break;
          else {
            const parityPerspective = { top: Side.Down, front: opposite(posPerspective.front) };
            //printArrangement(arrangement, degree);
            console.log(`fixing corner parity (PLL) (on ${toLetter(parityPerspective.front)})`);

            const moves = (() => {
              if (degree == 2)
                return [
                  { side: Side.Down, type: MoveType.CCW },
                  { side: Side.Right, type: MoveType.CW },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.CCW },
                  { side: Side.Down, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.Double },
                  { side: Side.Up, type: MoveType.CCW },
                  { side: Side.Right, type: MoveType.CW },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.Double },
                  { side: Side.Up, type: MoveType.CCW }
                ];
              else
                // 2x2 PLL parity algorithm works for 4x4, but puts us back at the SideEdges step (and causes OLL parity!)
                // There's a much longer algorithm we can use that will preserve the work we've done so far:
                return [
                  { side: Side.Up, type: MoveType.Double, layer: { depth: degree / 2, thick: true } },
                  { side: Side.Left, type: MoveType.Double, layer: { depth: degree / 2, thick: true } },
                  { side: Side.Up, type: MoveType.Double },
                  { side: Side.Left, type: MoveType.Double, layer: { depth: degree / 2, thick: false } },
                  { side: Side.Up, type: MoveType.Double },
                  { side: Side.Left, type: MoveType.Double, layer: { depth: degree / 2, thick: true } },
                  { side: Side.Up, type: MoveType.Double, layer: { depth: degree / 2, thick: true } },
                  { side: Side.Front, type: MoveType.CCW },
                  { side: Side.Up, type: MoveType.CCW },
                  { side: Side.Front, type: MoveType.CW },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Front, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.CCW },
                  { side: Side.Front, type: MoveType.Double },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Front, type: MoveType.CW },
                  { side: Side.Up, type: MoveType.CW },
                  { side: Side.Front, type: MoveType.CCW },
                  { side: Side.Up, type: MoveType.CCW },
                  { side: Side.Front, type: MoveType.CW },
                  { side: Side.Right, type: MoveType.CW }
                ];
            })();

            for (let i = 0; i < moves.length; i++) {
              move = {
                orientation: parityPerspective,
                ...moves[i]
              }; applyMove(move); yield move;
            }
          }
        }

        /* rotations */
        yield { text: 'Rotate Corners', level: 2 };

        let turns = 0;
        let needRotations = false;
        for (let i = 0; i < 4; i++) {
          if (arrangement[Side.Down][cornerSpaces[i]] != Color.Blue) {
            needRotations = true;
            break;
          }
        }
        if (needRotations) {
          const topRightAligned = () => arrangement[Side.Down][cornerSpaces[3]] == Color.Blue;
          let iIt = 0;
          for (let i = 0; i < 4; i++) {
            let rotatedOnce = false;
            let attempt = -1;
            while (!topRightAligned() && attempt < 15) { // attempt is an infinite-loop catch
              attempt++;
              if (!rotatedOnce) {
                rotatedOnce = true;
                iIt++;
                if (turns > 0) {
                  yield { text: '', level: 3 };
                  move = {
                    orientation: perspective,
                    side: Side.Up,
                    type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW,
                  }; yield move; // already applied on previous loop
                }
                turns = 0;

                yield { text: `${toOrdinal(iIt)} Corner`, level: 3 };
              }
              //printArrangement(arrangement, degree);
              console.log('top right not aligned');
              move = {
                orientation: perspective,
                side: Side.Right,
                type: MoveType.CCW
              }; applyMove(move); yield move;

              move = {
                orientation: perspective,
                side: Side.Down,
                type: MoveType.CCW
              }; applyMove(move); yield move;

              move = {
                orientation: perspective,
                side: Side.Right,
                type: MoveType.CW
              }; applyMove(move); yield move;

              move = {
                orientation: perspective,
                side: Side.Down,
                type: MoveType.CW
              }; applyMove(move); yield move;
            }
            if (i != 3) {
              move = {
                orientation: perspective,
                side: Side.Up,
                type: MoveType.CW,
              }; applyMove(move); // intentional no-yield - will yield later
              turns++;
            }
          }
        }


        if (turns > 0) {
          yield { text: '', level: 3 };
          move = {
            orientation: perspective,
            side: Side.Up,
            type: turns == 1 ? MoveType.CW : turns == 2 ? MoveType.Double : MoveType.CCW,
          }; yield move; // already applied on last loops
        }

        yield { text: 'Finish', level: 1 };

        /* twist */
        //printArrangement(arrangement, degree);
        console.log('looking for back');
        let attempt2 = 0; // infinite loop catch
        for (let jSC = sideCircle.findIndex(s => s == Side.Back); attempt2 < 15; jSC = (jSC + 1) % 4, attempt2++) {
          const side = sideCircle[jSC];
          if (arrangement[side][cornerSpaces[3]] == sideColors[Side.Back]) {
            let turns = 0;
            let attempt3 = 0; // infinite loop catch
            for (let iSC = jSC; sideCircle[iSC] != Side.Back && attempt3 < 15; iSC = (iSC + 1) % 4, turns++, attempt3++);
            if (turns != 0) {
              move = {
                orientation: perspective,
                side: Side.Up,
                type: (turns == 1) ? MoveType.CW : (turns == 2) ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;
            }
            break;
          }
        }

        yield { text: '', level: 0 };
      } break;

      default:
        console.log(`Solve procedure not implemented: ${steps[iStep]}`);
        break;
    }
  }

  console.log('solved: ');
  printArrangement(arrangement, degree);
}

