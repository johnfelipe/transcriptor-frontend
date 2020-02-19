import React, { useState, useEffect } from 'react';
import { Menu, Card } from 'semantic-ui-react';
import CustomCard from '../Utils/Card';

const ListTranscriptions = () => {
    const [ subPage, setSubPage ] = useState('Created');
    const [ transcriptionList, setTranscriptionList ] = useState([]);

    const handleSubTabClick = (e, { name }) => setSubPage(name);

    useEffect(() => {
        const URL = `${process.env.REACT_APP_API_HOST}/api/speech`;
        const token = localStorage.getItem('token');

        fetch(URL, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            const list = data.speeches;
            setTranscriptionList(list);
        });
    },[]); /* 
               useEffect(() => {...},[]) -> to make sure infinte loop doesn't occur 
               https://stackoverflow.com/questions/53715465/can-i-set-state-inside-a-useeffect-hook
           */

    const Empty = () => <h3 style={{ marginLeft: '4%', color: 'rgba(0,0,0,0.7)' }}>You haven't uploaded any files for transcriptions!</h3>

    const TranscriptionList = () => transcriptionList.map((each, key) => {
        const data = { header: each.uploadedFile.originalname, meta: each.createdAt };

        return <CustomCard key={key} data={data} />;
    });

    return (
        <React.Fragment>
            <Menu tabular style={{ marginLeft: '4%' }}>
                <Menu.Item
                    name='Created'
                    active={subPage === 'Created'}
                    onClick={handleSubTabClick}
                />
                <Menu.Item
                    name='Assigned'
                    active={subPage === 'Assigned'}
                    onClick={handleSubTabClick}
                />
            </Menu>

            {
                subPage === 'Created' && transcriptionList.length === 0 && <Empty />
            }
            {
                subPage === 'Created' && transcriptionList.length > 0 
                && <Card.Group style={{ marginLeft: '4%' }}>
                        <TranscriptionList />
                   </Card.Group>
            }
            
        </React.Fragment>
    )
}

export default ListTranscriptions;