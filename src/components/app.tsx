import * as React from "react";
import { Global, css } from '@emotion/react';
import Sidebar from './sidebar';
import { SimulationProps, SimulationState, Simulation } from './simulation/react_simulation';

export interface AppProps {
  degree: number,
};

export interface AppState {
};

export default class App extends React.Component<AppProps> {
  constructor(props: SimulationProps) {
    super(props);
  }

  render() {
    return (
      <div id="app">
        <Global styles={css`
          ::-webkit-scrollbar { background: black }
          ::-webkit-scrollbar-track { background: #202020; }
          ::-webkit-scrollbar-thumb { background: white; }
          ::-webkit-scrollbar-thumb:hover { background: #C0C0C0; }
          ::-webkit-scrollbar-thumb:active { background: #A0A0A0; }

          body {
            margin: 0px;
            background-color: black;
          }
        `} />
        <Simulation degree={this.props.degree} />
        <Sidebar />
      </div>
    );
  }
}

//<Tester />
//