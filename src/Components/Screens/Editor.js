/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import EventEmitter from 'event-emitter';
import '../styles.css';
import audioFile from '../../media/sonnet.mp3';

const WaveformPlaylist = require('waveform-playlist');

const Empty = () => (
    <h3 style={{ marginLeft: '4%', color: 'rgba(0,0,0,0.7)' }}>
        No file selected into Editor, go to 'My Transcriptions' to select a file!
    </h3>
);

const WaveForm = props => {
    let playlist = null;

    setTimeout(() => {
        playlist = WaveformPlaylist.init(
            {
                container: document.getElementById('waveform-playlist-container'),
                timescale: true,
                state: 'select',
                samplesPerPixel: 1024,
                colors: {
                    waveOutlineColor: '#E0EFF1',
                    timeColor: 'grey',
                    fadeColor: 'black',
                },
                annotationList: {
                    annotations: notes,
                    controls: actions,
                    editable: true,
                    isContinuousPlay: false,
                    linkEndpoints: true,
                },
            },
            EventEmitter()
        );
    }, 500);

    setTimeout(() => {
        playlist
            .load([
                {
                    src: `${audioFile}`,
                },
            ])
            .then(function() {
                //can do stuff with the playlist.
                console.log('done!');
            });
    }, 1000);

    return <></>;
};

const Editor = props => {
    const [transcriptionId, setTranscriptionId] = useState(null);

    useEffect(() => {
        let _id = null;

        if (localStorage.getItem('editorConfig') !== null) {
            const config = JSON.parse(localStorage.getItem('editorConfig'));

            _id = config._id;
        } else {
            _id = props._id;
        }

        setTranscriptionId(_id);
    }, []);

    return (
        <React.Fragment>
            {transcriptionId === null ? (
                <Empty />
            ) : (
                <React.Fragment>
                    <h3>{transcriptionId}</h3>
                    <div id="top-bar" className="playlist-top-bar">
                        <div className="playlist-toolbar">
                            <div className="btn-group">
                                <span className="btn-pause btn btn-warning">
                                    <i className="fa fa-pause"></i>
                                </span>
                                <span className="btn-play btn btn-success">
                                    <i className="fa fa-play"></i>
                                </span>
                                <span className="btn-stop btn btn-danger">
                                    <i className="fa fa-stop"></i>
                                </span>
                                <span className="btn-rewind btn btn-success">
                                    <i className="fa fa-fast-backward"></i>
                                </span>
                                <span className="btn-fast-forward btn btn-success">
                                    <i className="fa fa-fast-forward"></i>
                                </span>
                            </div>
                            <div className="btn-group">
                                <span title="zoom in" className="btn-zoom-in btn btn-default">
                                    <i className="fa fa-search-plus"></i>
                                </span>
                                <span title="zoom out" className="btn-zoom-out btn btn-default">
                                    <i className="fa fa-search-minus"></i>
                                </span>
                                <span
                                    title="Download the annotations as json"
                                    className="btn-annotations-download btn btn-default"
                                >
                                    Download JSON
                                </span>
                            </div>
                        </div>
                        <div id="waveform-playlist-container"></div>
                        <WaveForm _id={transcriptionId} />
                    </div>
                </React.Fragment>
            )}
        </React.Fragment>
    );
};

var actions = [
    {
        class: 'fa.fa-minus',
        title: 'Reduce annotation end by 0.010s',
        action: (annotation, i, annotations, opts) => {
            var next;
            var delta = 0.01;
            annotation.end -= delta;

            if (opts.linkEndpoints) {
                next = annotations[i + 1];
                next && (next.start -= delta);
            }
        },
    },
    {
        class: 'fa.fa-plus',
        title: 'Increase annotation end by 0.010s',
        action: (annotation, i, annotations, opts) => {
            var next;
            var delta = 0.01;
            annotation.end += delta;

            if (opts.linkEndpoints) {
                next = annotations[i + 1];
                next && (next.start += delta);
            }
        },
    },
    {
        class: 'fa.fa-scissors',
        title: 'Split annotation in half',
        action: (annotation, i, annotations) => {
            const halfDuration = (annotation.end - annotation.start) / 2;

            annotations.splice(i + 1, 0, {
                id: 'test',
                start: annotation.end - halfDuration,
                end: annotation.end,
                lines: ['----'],
                lang: 'en',
            });

            annotation.end = annotation.start + halfDuration;
        },
    },
    {
        class: 'fa.fa-trash',
        title: 'Delete annotation',
        action: (annotation, i, annotations) => {
            annotations.splice(i, 1);
        },
    },
];

const notes = [
    {
        begin: '0.000',
        children: [],
        end: '2.680',
        id: 'f000001',
        language: 'eng',
        lines: ['1'],
    },
    {
        begin: '2.680',
        children: [],
        end: '5.880',
        id: 'f000002',
        language: 'eng',
        lines: ['From fairest creatures we desire increase,'],
    },
    {
        begin: '5.880',
        children: [],
        end: '9.240',
        id: 'f000003',
        language: 'eng',
        lines: ["That thereby beauty's rose might never die,"],
    },
    {
        begin: '9.240',
        children: [],
        end: '11.920',
        id: 'f000004',
        language: 'eng',
        lines: ['But as the riper should by time decease,'],
    },
    {
        begin: '11.920',
        children: [],
        end: '15.280',
        id: 'f000005',
        language: 'eng',
        lines: ['His tender heir might bear his memory:'],
    },
    {
        begin: '15.280',
        children: [],
        end: '18.600',
        id: 'f000006',
        language: 'eng',
        lines: ['But thou contracted to thine own bright eyes,'],
    },
    {
        begin: '18.600',
        children: [],
        end: '22.800',
        id: 'f000007',
        language: 'eng',
        lines: ["Feed'st thy light's flame with self-substantial fuel,"],
    },
    {
        begin: '22.800',
        children: [],
        end: '25.680',
        id: 'f000008',
        language: 'eng',
        lines: ['Making a famine where abundance lies,'],
    },
    {
        begin: '25.680',
        children: [],
        end: '31.240',
        id: 'f000009',
        language: 'eng',
        lines: ['Thy self thy foe, to thy sweet self too cruel:'],
    },
    {
        begin: '31.240',
        children: [],
        end: '34.280',
        id: 'f000010',
        language: 'eng',
        lines: ["Thou that art now the world's fresh ornament,"],
    },
    {
        begin: '34.280',
        children: [],
        end: '36.960',
        id: 'f000011',
        language: 'eng',
        lines: ['And only herald to the gaudy spring,'],
    },
    {
        begin: '36.960',
        children: [],
        end: '40.680',
        id: 'f000012',
        language: 'eng',
        lines: ['Within thine own bud buriest thy content,'],
    },
    {
        begin: '40.680',
        children: [],
        end: '44.560',
        id: 'f000013',
        language: 'eng',
        lines: ["And tender churl mak'st waste in niggarding:"],
    },
    {
        begin: '44.560',
        children: [],
        end: '48.080',
        id: 'f000014',
        language: 'eng',
        lines: ['Pity the world, or else this glutton be,'],
    },
    {
        begin: '48.080',
        children: [],
        end: '53.240',
        id: 'f000015',
        language: 'eng',
        lines: ["To eat the world's due, by the grave and thee."],
    },
];

export default Editor;
