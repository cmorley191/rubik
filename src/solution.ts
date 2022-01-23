import { EdgesGeometry, StaticDrawUsage } from 'three';
import { Side, Axis, Color, Rotation, Move, Arrangement, transform, standardOrientation, getStandardSideOrientation, inspectSide, locateSide, MoveType, toRotation, rotateArrangement, getAxis, isPositive, sideRotations, opposite, toNotation, toLetter, oppositeColor, COLORS, printArrangement, reverse, Orientation } from './core';

function deepCopy(arr: Arrangement) {
  const copy = []
  for (let i = 0; i < 6; i++) {
    copy.push(arr[i].slice());
  }
  return copy;
}

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

  const edgeSpaces = [Math.floor(degree / 2), degree * Math.floor(degree / 2), degree * (Math.floor(degree / 2) + 1) - 1, degree * (degree - 1) + Math.floor(degree / 2)];
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

  const sideCircle = [Side.Front, Side.Right, Side.Back, Side.Left];
  const sideColors: Color[/*side*/] = COLORS;

  let steps: SolveProcedure[] = (() => {
    switch (degree) {
      case 4:
        return [
          SolveProcedure.Centers,
          /*SolveProcedure.EdgePairing,
          SolveProcedure.UpEdges,
          SolveProcedure.UpCorners,
          SolveProcedure.SideEdges,
          SolveProcedure.DownEdges,
          SolveProcedure.DownCorners,*/
        ];
      case 3:
        return [
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


  for (let iStep = 0; iStep < steps.length; iStep++) {
    let move: Move;
    switch (steps[iStep]) {

      case SolveProcedure.Centers: {
        const getAdjacentCenterSpace = (space: number, cw: boolean) => centerSpaceCircle[(centerSpaceCircle.findIndex(s => s == space) + (cw ? 1 : 3)) % 4];
        const assessCenters = (side: Side, expectedColor: Color) => {
          for (let iSpace = 0; iSpace < 4; iSpace++) {
            const space = centerSpaces[iSpace];
            if (arrangement[side][space] == expectedColor) {
              const cwSpace = getAdjacentCenterSpace(space, true);
              const dSpace = getAdjacentCenterSpace(cwSpace, true);
              const ccwSpace = getAdjacentCenterSpace(space, false);
              const [cwSet, dSet, ccwSet] = [cwSpace, dSpace, ccwSpace].map(s => arrangement[side][s] == expectedColor);

              return {
                count: 1 + (cwSet ? 1 : 0) + (ccwSet ? 1 : 0) + ((cwSet || ccwSet) && dSet ? 1 : 0),
                firstSpace: (!ccwSet) ? space : (!dSet) ? ccwSpace : dSpace,
              }
            }
          }
          return {
            count: 0,
            firstSpace: 0,
          }
        };

        /* down/up center */
        for (let iUD = 0; iUD < 2; iUD++) {
          const expectedColor = iUD == 0 ? Color.Blue : Color.Green;

          let spacesSet = 0;
          let normalSecondSpace = true;

          /* get first space */
          console.log('aligning pre-existing up center spaces');
          // check if one's already there
          const topCenters = assessCenters(Side.Up, expectedColor);
          spacesSet = topCenters.count;
          if (spacesSet > 0) {
            if (spacesSet != 4) {
              // rotate into position
              const ccwTurns = centerSpaceCircle.findIndex(s => s == topCenters.firstSpace);
              if (ccwTurns != 0) {
                move = {
                  orientation: standardOrientation,
                  side: Side.Up,
                  type: ccwTurns == 1 ? MoveType.CCW : ccwTurns == 2 ? MoveType.Double : MoveType.CW
                }; applyMove(move); yield move;
              }
            }
          }

          // look for space on the sides
          /* we will use roughly the method for the all the spaces, so loop */
          while (spacesSet < 4) {
            printArrangement(arrangement, degree);
            console.log(`looking for up spaces (found ${spacesSet} so far)`);

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

            const sidePerspective = getStandardSideOrientation(bestSide);
            if (bestCenters.count == 4) {
              // move them all up
              console.log('moving all 4 up!');
              move = {
                orientation: sidePerspective,
                side: Side.Right,
                layer: { depth: 2, thick: false },
                type: (bestSide == Side.Down) ? MoveType.Double : MoveType.CW
              }; applyMove(move); yield move;
              move = {
                orientation: sidePerspective,
                side: Side.Left,
                layer: { depth: 2, thick: false },
                type: (bestSide == Side.Down) ? MoveType.Double : MoveType.CCW
              }; applyMove(move); yield move;

              spacesSet = 4;
            } else {
              // found one or two

              // line up the first space
              const effectiveBestSide = (bestSide == Side.Down ? Side.Front : bestSide);
              console.log(`effective side: ${toLetter(effectiveBestSide)}`);
              const zeroThree = spacesSet == 0 || spacesSet == 3;

              const turns = (
                sideCircle.findIndex(s => s == effectiveBestSide)
                - centerSpaceCircle.findIndex(s => s == bestCenters.firstSpace)
                + (4 * 10) // buffer for subtractions
                + ((bestCenters.count > 1 && ((getAxis(effectiveBestSide) == Axis.Z) == (zeroThree))) ? -1 : 0)
                + (!zeroThree ? (getAxis(effectiveBestSide) == Axis.Z ? 1 : -1) : 0)
              ) % 4;
              console.log('turns lines:');
              console.log(sideCircle.findIndex(s => s == effectiveBestSide));
              console.log(- centerSpaceCircle.findIndex(s => s == bestCenters.firstSpace));
              console.log((bestCenters.count > 1 && ((getAxis(effectiveBestSide) == Axis.Z) == (zeroThree))) ? -1 : 0);
              console.log(!zeroThree ? (getAxis(effectiveBestSide) == Axis.Z ? 1 : -1) : 0);
              console.log(`turns: ${turns}`);
              if (turns > 0) {
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
                  orientation: standardOrientation,
                  side: Side.Up,
                  type: (getAxis(effectiveBestSide) == Axis.Z) ? MoveType.CCW : MoveType.CW
                }; applyMove(move); yield move;
              }
              if (spacesSet == 3 || iUD == 1) {
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
                  layer: { depth: 2, thick: true },
                  type: bestSide == Side.Down ? MoveType.Double : moveRight ? MoveType.CCW : MoveType.CW
                }; applyMove(move); yield move;
                // inject
                move = {
                  orientation: sidePerspective,
                  side: Side.Front,
                  type: spacesSet != 3 ? MoveType.Double : (getAxis(effectiveBestSide) == Axis.Z) ? MoveType.CW : MoveType.CCW
                }; applyMove(move); yield move;
              }

              console.log('moving up');
              // move it up
              move = {
                orientation: sidePerspective,
                side: moveRight ? Side.Right : Side.Left,
                layer: { depth: 2, thick: true },
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
                console.log('realigning top centers');
                move = {
                  orientation: standardOrientation,
                  side: Side.Up,
                  type: finalizeTurn
                }; applyMove(move); yield move;
              }
            }
          }

          if (iUD == 0) {
            console.log('moving bottom centers into place');
            move = {
              orientation: standardOrientation,
              side: Side.Right,
              layer: { depth: 2, thick: false },
              type: MoveType.Double
            }; applyMove(move); yield move;
            move = {
              orientation: standardOrientation,
              side: Side.Left,
              layer: { depth: 2, thick: false },
              type: MoveType.Double
            }; applyMove(move); yield move;
          }
        }

        /* side centers */
        for (let iSide = 0; iSide < 3; iSide++) { // 4th side will be set after 3rd side is
          const side = sideCircle[iSide];

          let spacesSet = 0;
          while (spacesSet < 3) {
            for (let jSide = 0; jSide < 4; jSide++) {
              if (jSide == iSide) continue;

            }
          }
        }
      } break;

      case SolveProcedure.UpEdges: {
        while (true) {
          //printArrangement(arrangement, degree);
          let solvedEdge = false;
          for (let side = 0; side < 6; side++) {
            for (let iEdge = 0; iEdge < 4; iEdge++) {
              let space = edgeSpaces[iEdge];
              if (arrangement[side][space] == Color.Green) {
                console.log(`Fixing green edge ${toLetter(side)}@${space}`);
                const sideOrientation = getStandardSideOrientation(side);
                const zeroThree = iEdge == 0 || iEdge == 3;

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
                  }; applyMove(move); yield move;

                  side = Side.Down;
                  space = iEdge == 0 ? edgeSpaces[3] : iEdge == 3 ? edgeSpaces[0] : space;
                } else if (side != Side.Down) {
                  if (zeroThree) {
                    /* move to the side (restore later) */
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: MoveType.CW,
                    }; applyMove(move); yield move;
                    space = edgeSpaces[iEdge == 0 ? 2 : 1];
                  }

                  // move down
                  move = {
                    orientation: sideOrientation,
                    side: space == edgeSpaces[2] ? Side.Right : Side.Left,
                    type: space == edgeSpaces[2] ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); yield move;

                  // move away 
                  move = {
                    orientation: sideOrientation,
                    side: Side.Down,
                    type: space == edgeSpaces[2] ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); yield move;

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: space == edgeSpaces[2] ? Side.Right : Side.Left,
                    type: space == edgeSpaces[2] ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); yield move;

                  if (zeroThree) {
                    // restore
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: MoveType.CCW,
                    }; applyMove(move); yield move;
                  }

                  space = edgeSpaceCircle[(sideCircle.findIndex(s => s == side) + 2) % 4];
                  side = Side.Down;
                }

                console.log(`Located down @ ${space}`);

                /* put in place */
                const edgeEdge = edgeEdges[edgeSpaces.findIndex(s => s == space)];
                const adjacentSide = inspectSide(edgeEdge, getStandardSideOrientation(Side.Down));
                const targetSide = sideColors.findIndex(c => c == arrangement[adjacentSide][edgeSpaces[3]]);
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
      } break;

      case SolveProcedure.UpCorners: {
        while (true) {
          printArrangement(arrangement, degree);
          let setSpace = false;
          for (let side = 0; side < 6; side++) {
            for (let iSpace = 0; iSpace < 4; iSpace++) {
              let space = cornerSpaces[iSpace]
              if (arrangement[side][space] == Color.Green && !(side == Side.Up)) {
                console.log(`fixing green corner ${toLetter(side)}@${space}`);

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
                  }; applyMove(move); yield move;

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Back,
                    type: zeroThree ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); yield move;

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: zeroThree ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); yield move;

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
                  for (let iSC = cornerSpaceCircle.findIndex(s => s == space); cornerSpaceCircle[iSC] != freeBottomSpace; iSC = (iSC + 1) % 4, turns++);
                  if (turns != 0) {
                    move = {
                      orientation: sideOrientation,
                      side: Side.Front,
                      type: (turns == 1) ? MoveType.CW : (turns == 2) ? MoveType.Double : MoveType.CCW
                    }; applyMove(move); yield move;

                    space = freeBottomSpace;
                  }

                  const [xEdge, yEdge] = cornerSpaceEdges[cornerSpaces.findIndex(s => s == space)];
                  const zeroThree = space == cornerSpaces[0] || space == cornerSpaces[3];
                  // move up
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: (zeroThree) ? MoveType.CW : MoveType.CCW
                  }; applyMove(move); yield move;

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Front,
                    type: (zeroThree) ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); yield move;

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: xEdge,
                    type: (zeroThree) ? MoveType.CCW : MoveType.CW
                  }; applyMove(move); yield move;

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
                  }; applyMove(move); yield move;

                  // move away
                  move = {
                    orientation: sideOrientation,
                    side: Side.Down,
                    type: (space == cornerSpaces[0]) ? MoveType.CCW : MoveType.CW,
                  }; applyMove(move); yield move;

                  // restore
                  move = {
                    orientation: sideOrientation,
                    side: Side.Front,
                    type: (space == cornerSpaces[0]) ? MoveType.CW : MoveType.CCW,
                  }; applyMove(move); yield move;

                  side = inspectSide(xEdge, sideOrientation);
                  space = cornerSpaces[cornerSpaces.findIndex(s => s == space) + 2];
                }

                /* move into appropriate top spot */
                const sideOrientation = getStandardSideOrientation(side);
                const [xEdge, yEdge] = cornerSpaceEdges[cornerSpaces.findIndex(s => s == space)];
                const [xSide] = [inspectSide(xEdge, sideOrientation)];
                const [xColor, yColor] = [
                  arrangement[xSide][space == cornerSpaces[3] ? cornerSpaces[2] : cornerSpaces[3]],
                  arrangement[Side.Down][cornerSpaceCircle[(sideCircle.findIndex(s => s == side) + cornerSpaces[(cornerSpaces.findIndex(s => s == space) - 2) % 4])]]
                ];
                const [xColorSide, yColorSide]: Side[] = [sideColors.findIndex(c => c == xColor), sideColors.findIndex(c => c == yColor)];
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
      }
        break;

      case SolveProcedure.SideEdges: {
        const perspective = { top: Side.Down, front: Side.Back };
        while (true) {
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
      } break;

      case SolveProcedure.DownCorners: {
        const perspective = { top: Side.Down, front: Side.Back };

        // loop to do these steps twice in case of parity
        while (true) {
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

          while (true) {
            /* try to find the right perspective */
            for (let i = 0; i < 4; i++) {
              if (topRightPositioned()) break;
              posPerspective = { top: Side.Down, front: sideCircle[(sideCircle.findIndex(s => s == posPerspective.front) + 1) % 4] };
            }

            if (!topRightPositioned()) {
              /* couldn't find it, fix with moves */
              printArrangement(arrangement, degree);
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

          while (!topLeftPositioned()) {
            printArrangement(arrangement, degree);
            console.log(`top left not positioned (looking at ${toLetter(posPerspective.front)})`);

            for (let i = 0; i < cycleCornersMoves.length; i++) {
              move = {
                orientation: posPerspective,
                ...cycleCornersMoves[i]
              }; applyMove(move); yield move;
            }
          }

          /* check if the opposite two corners have parity */
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

          if (backRightPositioned()) break;
          else {
            const parityPerspective = { top: Side.Down, front: opposite(posPerspective.front) };
            printArrangement(arrangement, degree);
            console.log(`fixing parity (on ${toLetter(parityPerspective.front)})`);

            const moves = [
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

            for (let i = 0; i < moves.length; i++) {
              move = {
                orientation: parityPerspective,
                ...moves[i]
              }; applyMove(move); yield move;
            }
          }
        }

        /* rotations */
        const topRightAligned = () => arrangement[Side.Down][cornerSpaces[3]] == Color.Blue;
        for (let i = 0; i < 4; i++) {
          while (!topRightAligned()) {
            printArrangement(arrangement, degree);
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
            }; applyMove(move); yield move;
          }
        }

        /* twist */
        printArrangement(arrangement, degree);
        console.log('looking for back');
        for (let jSC = sideCircle.findIndex(s => s == Side.Back); true; jSC = (jSC + 1) % 4) {
          const side = sideCircle[jSC];
          if (arrangement[side][cornerSpaces[3]] == sideColors[Side.Back]) {
            let turns = 0;
            for (let iSC = jSC; sideCircle[iSC] != Side.Back; iSC = (iSC + 1) % 4, turns++);
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
      } break;

      case SolveProcedure.DownEdges: {
        const perspective = { top: Side.Down, front: Side.Back };

        /* create the cross */
        {
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
          for (let iEdge = 0; iEdge < 4; iEdge++) {
            if (arrangement[Side.Down][edgeSpaces[iEdge]] != Color.Blue) {
              layoutsByEdge[iEdge].forEach(l => {
                const iPL = possibleLayouts.findIndex(l2 => l2 == l);
                if (iPL != null) delete possibleLayouts[iPL];
              });
            }
          }
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

          printArrangement(arrangement, degree);
          console.log(`Cross layout(s): ${possibleLayouts.join('+')}, doing iteration(s): ${iterations.join('+')}`);

          for (let iIt = 0; iIt < iterations.length; iIt++) {
            if (iIt == 1) {
              // previous it created a SE cross
              move = {
                orientation: perspective,
                side: Side.Up,
                type: MoveType.Double
              }; applyMove(move); yield move;
            }

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
        }

        /* arrange the cross */
        {
          let arrangePerspective = perspective;
          while (true) {
            printArrangement(arrangement, degree);
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

      } break;

      default:
        console.log(`Solve procedure not implemented: ${steps[iStep]}`);
        break;
    }
  }
}

