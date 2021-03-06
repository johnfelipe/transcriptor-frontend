import React, { useState } from 'react';
import { Button, Form } from 'semantic-ui-react';
import InputError from '../Error/FormField';
import { Redirect } from 'react-router-dom';
import PropTypes from 'prop-types';
import '../styles.css';

import dataProvider from '../dataProvider';
import { useToasts } from 'react-toast-notifications';

const LoginForm = props => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [firstname, setFirstName] = useState('');
    const [errorState, setErrorState] = useState({
        email: null,
        password: null,
    });

    const { addToast } = useToasts();

    const styles = LoginFormStyles;

    const handleInputChange = (setFunction, fieldValue) => setFunction(fieldValue);

    const authenticateUser = () => {
        setErrorState({ email: null, password: null });
        setLoading(true);

        /* 
            Validate form Data
        */
        if (email === '') {
            setErrorState({ ...errorState, email: 'empty' });
        } else if (email !== '' && password === '') {
            setErrorState({ ...errorState, password: 'empty' });
        } else if (email !== '' && password !== '') {
            const formData = { email, password };

            /*
                Send email and password values to the backend to authenticate
            */
            dataProvider
                .auth('login', {
                    options: {
                        data: formData,
                    },
                })
                .then(res => {
                    if (res.status === 200) {
                        const token = res.data.user.token;
                        localStorage.setItem('token', token);

                        setFirstName(res.data.user.firstname);
                        setErrorState({ email: 'correct', password: 'correct' });
                    } else {
                        setErrorState({ ...errorState, email: 'wrong' });
                    }
                })
                .catch(err => {
                    addToast(err.response.data.message, {
                        autoDismiss: true,
                        appearance: 'error',
                        autoDismissTimeout: 3000,
                    });
                });
        }

        setLoading(false);
    };

    return (
        <React.Fragment>
            {errorState.email === 'correct' && errorState.password === 'correct' && (
                <Redirect
                    to={{
                        pathname: '/dashboard',
                        state: { email, firstname },
                    }}
                />
            )}
            <h3 style={styles.title}>Sign in</h3>
            <Form style={styles.FormBox}>
                <Form.Field style={styles.inputField}>
                    <input
                        id="email"
                        type="text"
                        placeholder="Email ID"
                        style={errorState.email !== null ? { ...styles.input, ...styles.error } : styles.input}
                        onChange={e => handleInputChange(setEmail, e.target.value)}
                    />

                    {errorState.email === 'empty' && <InputError message={`Enter an email ID`} />}

                    {errorState.email === 'wrong' && <InputError message={`Couldn't find your account`} />}
                </Form.Field>
                <Form.Field style={styles.inputField}>
                    <input
                        id="password"
                        type="password"
                        placeholder="Password"
                        style={errorState.password !== null ? { ...styles.input, ...styles.error } : styles.input}
                        onChange={e => handleInputChange(setPassword, e.target.value)}
                    />
                    {errorState.password === 'empty' && <InputError message={`Enter a password`} />}

                    {errorState.password === 'wrong' && <InputError message={`Wrong password. Try again`} />}
                </Form.Field>
                <Button
                    type="submit"
                    className="next-btn"
                    style={styles.button}
                    loading={loading}
                    onClick={authenticateUser}
                >
                    Next
                </Button>
                <Form.Field>
                    <label id="register" style={styles.label}>
                        <a href="/register" style={styles.label.a}>
                            Create account
                        </a>
                    </label>
                </Form.Field>
            </Form>
        </React.Fragment>
    );
};

/* 
  Define LoginForm PropTypes
*/
LoginForm.propTypes = {
    location: PropTypes.object,
};

/*
  Define Styles for the LoginForm Component
*/
const LoginFormStyles = {
    FormBox: {
        marginTop: '3em',
        fontFamily: 'Open Sans',
        fontWeight: '400',
    },
    inputField: {
        margin: '1em ',
        fontSize: '16px',
        width: '92%',
    },
    input: {
        margin: '1px 1px 0px',
        padding: '13px 15px',
        width: '97.514%',
        height: '54px',
        border: '1px solid rgba(0,0,0,0.2)',
    },
    button: {
        margin: '24px',
        position: 'absolute',
        right: '0',
        width: '88px',
        height: '36px',
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: '#fff',
    },
    label: {
        margin: '30px 16px',
        fontSize: '15px',
        fontWeight: 'bold',
        position: 'absolute',
        a: {
            textDecoration: 'none',
            color: 'rgba(0,0,0,0.8)',
        },
    },
    error: {
        border: '1.5px solid #d93025',
    },
    title: {
        fontSize: '24px',
        textAlign: 'center',
        fontFamily: 'Open Sans',
        fontWeight: '400',
    },
};

export default LoginForm;
