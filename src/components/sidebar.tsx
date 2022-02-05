import * as React from "react";
import { Global, css } from '@emotion/react';
import { range } from "../core";

import * as imgControls from '../images/controls.png';

export default class Sidebar extends React.Component {
  render() {
    const degreeButtons =
      range(2, 4).map((degree, i) => {
        function onClick() {
          window.location.href = `${window.location.href.split('?')[0]}?s=${degree}`;
        }
        return (
          <button key={i} className='degreeButton' onClick={onClick} >
            {degree}x{degree}
          </button >
        )
      });

    return (
      <div id="sidebar">
        <Global styles={css`
          #sidebar {
            pointer-events: none;
            visibility: hidden; /* changed on page load */
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 2;
          }

          #sidebar > * {
            margin-left: 10px; /* helps align with controls image */
            margin-bottom: 20px; /* spacing */
          }

          #sidebar * button {
            pointer-events: auto;
            margin-right: 5px; /* spacing between buttons */
            background-color: #202020;
            color: white;
          }

          
          #solution_container {
            max-width: 500px;
            max-height: 50vh;
            overflow-y: auto;
            direction: rtl;
          }
          #solution_container > * {
            direction: ltr;
            margin: 5px 10px 10px 10px;
          }

          #solution_text {
            color: white;
            font-size: 26px;
            font-family: Georgia, 'Times New Roman', Times, serif; 
          }

          .solution_step {
            margin-left: 0px;
            margin-right: 10px;
          }
        `} />

        <div> {degreeButtons} </div>
        <img id="controls" src={imgControls} css={css`margin-left: 0px; max-width: 60%;`} />
        <div id="solution_container" className="solution" >
          <p id="solution_text" className="solution" ></p>
        </div>
      </div >
    );
  }
}

